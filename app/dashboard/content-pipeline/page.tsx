import { redirect } from 'next/navigation'

// The old Queue / Calendar / Assets page was replaced by /dashboard/pipeline (Content: jobs, calendar, picture library).
export default function ContentPipelineRedirect() {
    redirect('/dashboard/pipeline')
}
