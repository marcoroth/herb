const std = @import("std");

const erbx = @cImport({
    @cInclude("/Users/marcoroth/Development/erbx/src/include/erbx.h");
});

pub fn main() !void {
    // Prints to stderr (it's a shortcut based on `std.io.getStdErr()`)
    std.debug.print("All your {s} are belong to us.\n", .{"codebase"});
}

// const c_html: [*c]const u8 = &"<img required />"[0]; // Get a C-compatible pointer

test "erbx" {
    const html: *const [13:0]u8 = "<html></html>"; // String literal, null-terminated
    const c_html: [*c]u8 = html[0]; // Get C-style pointer

    const buffer: [*c]erbx.buffer_T = undefined; // Use C struct type

    const init = erbx.buffer_init(buffer); // Explicit cast

    if (init) {
        erbx.erbx_lex_to_buffer(c_html, buffer);
    }
}

test "simple test" {
    var list = std.ArrayList(i32).init(std.testing.allocator);
    defer list.deinit(); // try commenting this out and see if zig detects the memory leak!
    try list.append(42);
    try std.testing.expectEqual(@as(i32, 42), list.pop());
}
