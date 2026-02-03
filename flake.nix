{
  description = "Herb";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # JavaScript/TypeScript
            nodejs_22
            yarn

            # Ruby
            ruby_4_0
            bundler

            # Rust
            rustc
            cargo
            clippy
            rustfmt

            # Java (JNI bindings)
            jdk17

            # C/C++ toolchain
            llvmPackages_21.clang
            llvmPackages_21.clang-tools # clang-format, clang-tidy

            # C testing
            check

            # WebAssembly
            emscripten

            # Documentation
            doxygen

            # Build tools and libraries
            gnumake
            libyaml
            nodePackages."yarn"
          ];

          shellHook = ''
            export cc=clang
            export clang_format=clang-format
            export clang_tidy=clang-tidy
            export check_prefix=${pkgs.check}
          '';
        };
      }
    );
}
