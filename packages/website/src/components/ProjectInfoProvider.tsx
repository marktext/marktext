'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_PROJECT_INFO, getProjectInfo, type ProjectInfo } from '@/lib/project-info'

const ProjectInfoContext = createContext<ProjectInfo>(DEFAULT_PROJECT_INFO)

export function useProjectInfo() {
  return useContext(ProjectInfoContext)
}

export default function ProjectInfoProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ProjectInfo>(DEFAULT_PROJECT_INFO)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    void getProjectInfo(controller.signal)
      .then((result) => {
        if (mounted) {
          setInfo({
            releaseVersion: result.releaseVersion ?? DEFAULT_PROJECT_INFO.releaseVersion,
            githubStars: result.githubStars ?? DEFAULT_PROJECT_INFO.githubStars,
            contributors: result.contributors ?? DEFAULT_PROJECT_INFO.contributors
          })
        }
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
