// 无头自测的虚拟键盘 + 虚拟指针（zwp_virtual_keyboard_v1、zwlr_virtual_pointer_v1），由 scripts/qmlcheck.sh 的 P3_INPUT 使用。
// 只在 qmlcheck 的无头 sway 里运行（要求 P3_W、SWAYSOCK，且没有 NIRI_SOCKET），不会在真桌面上发按键。
// 从 stdin 逐行读命令，每条处理完写一行 "ok" 到 stdout：
//   key <键>        例如 j、G（= shift+g）、ctrl+d、shift+g、esc、enter、space、backspace、slash、up、tab、f1
//   down <键> / up <键>   只按下 / 只松开（按住确认）
//   abs <x> <y>     指针移到输出坐标（1920×1080）
//   click [left|right] / press [left|right] / release [left|right]
//   wheel <n>       滚轮 n 格（正数向下）
// 编译：cc -O2 -o vinput scripts/vinput.c -lwayland-client -lxkbcommon（协议的 wl_interface 表直接写在下面，不需要 wayland-scanner）
#define _GNU_SOURCE
#include <ctype.h>
#include <linux/input-event-codes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>
#include <wayland-client.h>
#include <xkbcommon/xkbcommon.h>

extern const struct wl_interface zwp_virtual_keyboard_v1_interface;
extern const struct wl_interface zwlr_virtual_pointer_v1_interface;
static const struct wl_interface *types[] = {
    NULL, NULL, NULL, NULL, NULL,
    &wl_seat_interface, &zwp_virtual_keyboard_v1_interface,
    &wl_seat_interface, &zwlr_virtual_pointer_v1_interface,
};
static const struct wl_message vkm_req[] = { { "create_virtual_keyboard", "on", types + 5 } };
const struct wl_interface zwp_virtual_keyboard_manager_v1_interface = { "zwp_virtual_keyboard_manager_v1", 1, 1, vkm_req, 0, NULL };
static const struct wl_message vk_req[] = {
    { "keymap", "uhu", types }, { "key", "uuu", types }, { "modifiers", "uuuu", types }, { "destroy", "", types },
};
const struct wl_interface zwp_virtual_keyboard_v1_interface = { "zwp_virtual_keyboard_v1", 1, 4, vk_req, 0, NULL };
static const struct wl_message vpm_req[] = { { "create_virtual_pointer", "?on", types + 7 }, { "destroy", "", types } };
const struct wl_interface zwlr_virtual_pointer_manager_v1_interface = { "zwlr_virtual_pointer_manager_v1", 1, 2, vpm_req, 0, NULL };
static const struct wl_message vp_req[] = {
    { "motion", "uff", types }, { "motion_absolute", "uuuuu", types }, { "button", "uuu", types }, { "axis", "uuf", types },
    { "frame", "", types }, { "axis_source", "u", types }, { "axis_stop", "uu", types }, { "axis_discrete", "uufi", types },
    { "destroy", "", types },
};
const struct wl_interface zwlr_virtual_pointer_v1_interface = { "zwlr_virtual_pointer_v1", 1, 9, vp_req, 0, NULL };

static struct wl_display *dpy;
static struct wl_seat *seat;
static struct wl_proxy *vkm, *vpm, *kb, *ptr;
static uint32_t m_shift, m_ctrl, m_alt;

static void reg_global(void *d, struct wl_registry *r, uint32_t n, const char *i, uint32_t v) {
    (void)d; (void)v;
    if (!strcmp(i, "wl_seat") && !seat)
        seat = wl_registry_bind(r, n, &wl_seat_interface, 1);
    else if (!strcmp(i, zwp_virtual_keyboard_manager_v1_interface.name))
        vkm = wl_registry_bind(r, n, &zwp_virtual_keyboard_manager_v1_interface, 1);
    else if (!strcmp(i, zwlr_virtual_pointer_manager_v1_interface.name))
        vpm = wl_registry_bind(r, n, &zwlr_virtual_pointer_manager_v1_interface, 1);
}
static void reg_remove(void *d, struct wl_registry *r, uint32_t n) { (void)d; (void)r; (void)n; }
static const struct wl_registry_listener reg_l = { reg_global, reg_remove };

static uint32_t now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint32_t)(t.tv_sec * 1000 + t.tv_nsec / 1000000);
}
static void sync_wait(int ms) {
    wl_display_roundtrip(dpy);
    usleep(ms * 1000);
}

static const struct { const char *n; int c; } names[] = {
    { "esc", KEY_ESC }, { "escape", KEY_ESC }, { "enter", KEY_ENTER }, { "return", KEY_ENTER }, { "space", KEY_SPACE },
    { "backspace", KEY_BACKSPACE }, { "tab", KEY_TAB }, { "up", KEY_UP }, { "down", KEY_DOWN }, { "left", KEY_LEFT },
    { "right", KEY_RIGHT }, { "home", KEY_HOME }, { "end", KEY_END }, { "pageup", KEY_PAGEUP }, { "pagedown", KEY_PAGEDOWN },
    { "slash", KEY_SLASH }, { "/", KEY_SLASH }, { "minus", KEY_MINUS }, { "-", KEY_MINUS }, { "period", KEY_DOT }, { ".", KEY_DOT },
    { "bracketleft", KEY_LEFTBRACE }, { "[", KEY_LEFTBRACE }, { "bracketright", KEY_RIGHTBRACE }, { "]", KEY_RIGHTBRACE },
    { "f1", KEY_F1 }, { "f2", KEY_F2 },
};
static const int letters[26] = {
    KEY_A, KEY_B, KEY_C, KEY_D, KEY_E, KEY_F, KEY_G, KEY_H, KEY_I, KEY_J, KEY_K, KEY_L, KEY_M,
    KEY_N, KEY_O, KEY_P, KEY_Q, KEY_R, KEY_S, KEY_T, KEY_U, KEY_V, KEY_W, KEY_X, KEY_Y, KEY_Z,
};
static const int digits[10] = { KEY_0, KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9 };

// "ctrl+shift+g" → 键码 + 修饰键掩码；单个大写字母 = shift + 该字母
static int parse(char *spec, uint32_t *mods) {
    *mods = 0;
    char *last = spec;
    for (char *p = strchr(spec, '+'); p && p[1]; p = strchr(last, '+')) {
        *p = 0;
        if (!strcmp(last, "ctrl")) *mods |= m_ctrl;
        else if (!strcmp(last, "shift")) *mods |= m_shift;
        else if (!strcmp(last, "alt")) *mods |= m_alt;
        else return -1;
        last = p + 1;
    }
    if (strlen(last) == 1 && isalpha((unsigned char)last[0])) {
        if (isupper((unsigned char)last[0])) *mods |= m_shift;
        return letters[tolower((unsigned char)last[0]) - 'a'];
    }
    if (strlen(last) == 1 && isdigit((unsigned char)last[0]))
        return digits[last[0] - '0'];
    for (size_t i = 0; i < sizeof names / sizeof names[0]; i++)
        if (!strcasecmp(names[i].n, last))
            return names[i].c;
    return -1;
}
static void mod_keys(uint32_t mods, int state) {
    if (mods & m_ctrl) wl_proxy_marshal_flags(kb, 1, NULL, 1, 0, now(), KEY_LEFTCTRL, state);
    if (mods & m_shift) wl_proxy_marshal_flags(kb, 1, NULL, 1, 0, now(), KEY_LEFTSHIFT, state);
    if (mods & m_alt) wl_proxy_marshal_flags(kb, 1, NULL, 1, 0, now(), KEY_LEFTALT, state);
}
static void key(int code, uint32_t mods, int press, int release) {
    if (press) {
        mod_keys(mods, 1);
        wl_proxy_marshal_flags(kb, 2, NULL, 1, 0, mods, 0, 0, 0);
        wl_proxy_marshal_flags(kb, 1, NULL, 1, 0, now(), code, 1);
        sync_wait(30);
    }
    if (release) {
        wl_proxy_marshal_flags(kb, 1, NULL, 1, 0, now(), code, 0);
        mod_keys(mods, 0);
        wl_proxy_marshal_flags(kb, 2, NULL, 1, 0, 0, 0, 0, 0);
        sync_wait(30);
    }
}
static uint32_t button(const char *s) {
    return s && !strcmp(s, "right") ? BTN_RIGHT : s && !strcmp(s, "middle") ? BTN_MIDDLE : BTN_LEFT;
}
static void pbutton(uint32_t b, int state) {
    wl_proxy_marshal_flags(ptr, 2, NULL, 1, 0, now(), b, state);
    wl_proxy_marshal_flags(ptr, 4, NULL, 1, 0);
    sync_wait(40);
}

int main(void) {
    if (!getenv("P3_W") || !getenv("SWAYSOCK") || getenv("NIRI_SOCKET")) {
        fprintf(stderr, "vinput: only inside the headless sway of scripts/qmlcheck.sh\n");
        return 2;
    }
    dpy = wl_display_connect(NULL);
    if (!dpy) {
        fprintf(stderr, "vinput: no wayland display\n");
        return 1;
    }
    struct wl_registry *reg = wl_display_get_registry(dpy);
    wl_registry_add_listener(reg, &reg_l, NULL);
    wl_display_roundtrip(dpy);
    if (!seat || !vkm || !vpm) {
        fprintf(stderr, "vinput: compositor lacks wl_seat / virtual keyboard / virtual pointer\n");
        return 1;
    }

    struct xkb_context *ctx = xkb_context_new(XKB_CONTEXT_NO_FLAGS);
    struct xkb_rule_names rn = { .layout = "us" };
    struct xkb_keymap *km = ctx ? xkb_keymap_new_from_names(ctx, &rn, XKB_KEYMAP_COMPILE_NO_FLAGS) : NULL;
    char *text = km ? xkb_keymap_get_as_string(km, XKB_KEYMAP_FORMAT_TEXT_V1) : NULL;
    if (!text) {
        fprintf(stderr, "vinput: cannot build keymap\n");
        return 1;
    }
    m_shift = 1u << xkb_keymap_mod_get_index(km, XKB_MOD_NAME_SHIFT);
    m_ctrl = 1u << xkb_keymap_mod_get_index(km, XKB_MOD_NAME_CTRL);
    m_alt = 1u << xkb_keymap_mod_get_index(km, XKB_MOD_NAME_ALT);
    size_t size = strlen(text) + 1;
    int fd = memfd_create("vinput-keymap", MFD_CLOEXEC);
    if (fd < 0 || write(fd, text, size) != (ssize_t)size) {
        fprintf(stderr, "vinput: cannot write keymap\n");
        return 1;
    }

    kb = wl_proxy_marshal_flags(vkm, 0, &zwp_virtual_keyboard_v1_interface, 1, 0, seat, NULL);
    wl_proxy_marshal_flags(kb, 0, NULL, 1, 0, WL_KEYBOARD_KEYMAP_FORMAT_XKB_V1, fd, (uint32_t)size);
    ptr = wl_proxy_marshal_flags(vpm, 0, &zwlr_virtual_pointer_v1_interface, 1, 0, seat, NULL);
    sync_wait(200);

    char line[256];
    while (fgets(line, sizeof line, stdin)) {
        char cmd[32] = "", a[64] = "", b[64] = "";
        int n = sscanf(line, "%31s %63s %63s", cmd, a, b);
        if (n < 1)
            continue;
        uint32_t mods;
        int code;
        if (!strcmp(cmd, "key") || !strcmp(cmd, "down") || !strcmp(cmd, "up")) {
            if (n < 2 || (code = parse(a, &mods)) < 0) {
                fprintf(stderr, "vinput: unknown key %s\n", a);
            } else {
                key(code, mods, strcmp(cmd, "up") != 0, strcmp(cmd, "down") != 0);
            }
        } else if (!strcmp(cmd, "abs") && n == 3) {
            wl_proxy_marshal_flags(ptr, 1, NULL, 1, 0, now(), (uint32_t)atoi(a), (uint32_t)atoi(b), 1920u, 1080u);
            wl_proxy_marshal_flags(ptr, 4, NULL, 1, 0);
            sync_wait(20);
        } else if (!strcmp(cmd, "click")) {
            pbutton(button(n > 1 ? a : NULL), 1);
            pbutton(button(n > 1 ? a : NULL), 0);
        } else if (!strcmp(cmd, "press")) {
            pbutton(button(n > 1 ? a : NULL), 1);
        } else if (!strcmp(cmd, "release")) {
            pbutton(button(n > 1 ? a : NULL), 0);
        } else if (!strcmp(cmd, "wheel") && n >= 2) {
            int steps = atoi(a), dir = steps < 0 ? -1 : 1;
            for (int i = 0; i < abs(steps); i++) {
                wl_proxy_marshal_flags(ptr, 5, NULL, 1, 0, WL_POINTER_AXIS_SOURCE_WHEEL);
                wl_proxy_marshal_flags(ptr, 7, NULL, 1, 0, now(), WL_POINTER_AXIS_VERTICAL_SCROLL, wl_fixed_from_int(15 * dir), dir);
                wl_proxy_marshal_flags(ptr, 4, NULL, 1, 0);
                sync_wait(40);
            }
        } else {
            fprintf(stderr, "vinput: unknown command %s", line);
        }
        printf("ok\n");
        fflush(stdout);
    }
    wl_proxy_marshal_flags(kb, 3, NULL, 1, WL_MARSHAL_FLAG_DESTROY);
    wl_proxy_marshal_flags(ptr, 8, NULL, 1, WL_MARSHAL_FLAG_DESTROY);
    wl_display_roundtrip(dpy);
    wl_display_disconnect(dpy);
    return 0;
}
