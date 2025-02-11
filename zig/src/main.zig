const std = @import("std");

const erbx = @cImport({
    @cInclude("/Users/marcoroth/Development/erbx/src/include/erbx.h");
});

pub fn lex() void {
    const html: *const [13:0]u8 = "<html></html>"; // String literal, null-terminated
    const c_html: [*c]u8 = html[0]; // Get C-style pointer

    const buffer: [*c]erbx.buffer_T = undefined; // Use C struct type
    const init = erbx.buffer_init(buffer); // Explicit cast

    if (init) {
        erbx.erbx_lex_to_buffer(c_html, buffer);
        //_ = erbx.erbx_lex(c_html);

        //std.log.info("{}", .{hello[0].capacity});
    }
}

pub fn main() !void {
    lex();
}

test "erbx" {
    lex();
}
