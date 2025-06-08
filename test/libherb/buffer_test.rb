# frozen_string_literal: true

require_relative "../test_helper"

module LibHerb
  class BufferTest < Minitest::Spec
    def setup
      skip
    end

    test "buffer initialization" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_instance_of Herb::LibHerb::Buffer, buffer
        assert buffer.pointer.is_a?(FFI::Pointer)
      end
    end

    test "buffer read" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_equal "", buffer.read
      end
    end

    test "buffer value" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_equal "", buffer.read
      end
    end

    test "buffer append" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_equal "", buffer.read

        buffer.append("hello world")

        assert_equal "hello world", buffer.read
        assert_equal 11, buffer.length
      end
    end

    test "buffer append causing a realloc" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_equal "", buffer.read
        assert_equal 0, buffer.length
        assert_equal 8192, buffer.capacity

        string = "0123456789" * 64 # 640 bytes

        buffer.append(string)

        assert_equal string, buffer.read
        assert_equal 640, buffer.length
        assert_equal 8192, buffer.capacity # no realloc yet

        buffer.append(string)

        assert_equal "#{string}#{string}", buffer.read
        assert_equal 1280, buffer.length
        assert_equal 16_384, buffer.capacity # now it doubled
      end
    end

    test "buffer length and capacity" do
      Herb::LibHerb::Buffer.with do |buffer|
        assert_equal buffer.length, 0
        assert_equal buffer.capacity, 8192

        assert buffer.capacity >= buffer.length, "Buffer capacity should be at least the length"
      end
    end
  end
end
