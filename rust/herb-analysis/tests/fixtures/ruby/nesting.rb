# frozen_string_literal: true

CONFIG = :top_level

module Admin
  CONFIG = :admin_level

  class UsersController
    def show
      ::CONFIG
    end
  end

  class Reports
    def run
      CONFIG
    end
  end
end

module Status
  ACTIVE = :active
end

module Billing
  class Invoice
    CONFIG = :invoice_level
  end
end
