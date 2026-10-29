
export interface PrefControlBaseProps {
  description?: string
  notes?: string
  wide?: boolean
  /** External URL opened when the info icon is clicked. */
  more?: string
  /** When true, the control renders disabled / under-development. */
  disable?: boolean
}

export interface PrefControlProps<T> extends PrefControlBaseProps {
  value: T
  onChange: (value: T) => void
}

export interface PrefSelectOption<T = string | number> {
  label: string
  value: T
}
