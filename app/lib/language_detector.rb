# frozen_string_literal: true

class LanguageDetector
  include Singleton

  def initialize
  end

  def detect(text, account)
    default_locale(account)
  end

  private

  def default_locale(account)
    account.user_locale&.to_sym
  end
end
