module FormattingHelper
  extend ActiveSupport::Concern

  def format_price(cents)
    "$%.2f" % (cents / 100.0)
  end

  def format_date(date)
    date.strftime("%B %-d, %Y")
  end
end
