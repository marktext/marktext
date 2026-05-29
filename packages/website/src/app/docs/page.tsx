import { redirect } from 'next/navigation'
import { firstPageOfTab } from '@/lib/docs-nav'

export default function DocsIndex() {
  redirect(firstPageOfTab('user').href)
}
