module CTE8bit
  def mail(headers={}, &block)
    m = super(headers, &block)
    m.transport_encoding = '8bit'
  end
end

class ActionMailer::Base
  prepend CTE8bit
end
