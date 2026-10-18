'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getProjectInfo, type ProjectInfo } from '@/lib/project-info'

const ProjectInfoContext = createContext<ProjectInfo>({})

export function useProjectInfo() {
  return useContext(ProjectInfoContext)
}

export default function ProjectInfoProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ProjectInfo>({})

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    void getProjectInfo(controller.signal)
      .then((result) => {
        if (mounted) setInfo(result)
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      mounted = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  return <ProjectInfoContext.Provider value={info}>{children}</ProjectInfoContext.Provider>
}
