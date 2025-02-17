# frozen_string_literal: true

require_relative "../test_helper"

module LibERBX
  class BufferTest < Minitest::Spec
    test "buffer initialization" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_instance_of ERBX::LibERBX::Buffer, buffer
        assert buffer.pointer.is_a?(FFI::Pointer)
      end
    end

    test "buffer read" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_equal "", buffer.read
      end
    end

    test "buffer value" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_equal "", buffer.read
      end
    end

    test "buffer append" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_equal "", buffer.read

        buffer.append("hello world")

        assert_equal "hello world", buffer.read
        assert_equal 11, buffer.length
      end
    end

    test "buffer append causing a realloc" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_equal "", buffer.read
        assert_equal 0, buffer.length
        assert_equal 1024, buffer.capacity

        string = "0123456789" * 64 # 640 bytes

        buffer.append(string)

        assert_equal string, buffer.read
        assert_equal 640, buffer.length
        assert_equal 1024, buffer.capacity # no realloc yet

        buffer.append(string)

        assert_equal "#{string}#{string}", buffer.read
        assert_equal 1280, buffer.length
        assert_equal 2560, buffer.capacity # now it doubled
      end
    end

    test "buffer length and capacity" do
      ERBX::LibERBX::Buffer.with do |buffer|
        assert_equal buffer.length, 0
        assert_equal buffer.capacity, 1024

        assert buffer.capacity >= buffer.length, "Buffer capacity should be at least the length"
      end
    end
  end
end
