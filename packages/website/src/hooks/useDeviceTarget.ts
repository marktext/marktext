'use client'

import { useEffect, useState } from 'react'
import { detectDeviceTarget, getDeviceTarget, type DeviceTarget } from '@/lib/device-target'

export function useDeviceTarget(): DeviceTarget {
  const [target, setTarget] = useState<DeviceTarget>({ platform: null, architecture: null })
  useEffect(() => {
    let active = true
    setTarget(getDeviceTarget(navigator))
    void detectDeviceTarget(navigator).then((detected) => {
      if (active) setTarget(detected)
    })
    return () => {
      active = false
    }
  }, [])
  return target
}
