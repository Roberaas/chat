'use client'
import { useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function PhoneInput({ value, onChange, placeholder = '05__ ___ __ __', className = 'inp', disabled }: Props) {

  function mask(raw: string): string {
    // Sadece rakam al
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    if (!digits) return ''
    // 05XX XXX XX XX formatı
    let result = ''
    for (let i = 0; i < digits.length; i++) {
      if (i === 4) result += ' '
      else if (i === 7) result += ' '
      else if (i === 9) result += ' '
      result += digits[i]
    }
    return result
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = mask(e.target.value)
    onChange(masked)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace - masked değerden son karakteri sil
    if (e.key === 'Backspace' && value.endsWith(' ')) {
      e.preventDefault()
      onChange(value.slice(0, -2))
    }
  }

  return (
    <input
      type="tel"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      maxLength={14}
      inputMode="numeric"
    />
  )
}
