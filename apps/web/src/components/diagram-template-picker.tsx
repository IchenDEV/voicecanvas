import { Blocks, CalendarDays, ChartPie, Database, GitBranch, MessagesSquare, Network, Route } from 'lucide-react'
import { diagramTemplates, type DiagramTemplate, type DiagramTemplateId } from '@voicecanvas/core'

type DiagramTemplatePickerProps = {
  onStartTemplate: (templateId: DiagramTemplateId) => void
}

const templateIcons: Record<DiagramTemplateId, typeof Network> = {
  ideas: Network,
  process: GitBranch,
  handoff: MessagesSquare,
  schedule: CalendarDays,
  'data-model': Database,
  timeline: Route,
  proportion: ChartPie,
  'system-map': Blocks,
}

export function DiagramTemplatePicker({ onStartTemplate }: DiagramTemplatePickerProps) {
  return (
    <section className="template-picker" aria-label="Diagram templates">
      <div className="template-picker-header">
        <span>Choose a starting point</span>
        <p>Pick the shape that matches the work. You can rename and change it after it appears.</p>
      </div>
      <div className="template-grid">
        {diagramTemplates.map((template) => (
          <DiagramTemplateButton key={template.id} template={template} onStartTemplate={onStartTemplate} />
        ))}
      </div>
    </section>
  )
}

function DiagramTemplateButton({
  template,
  onStartTemplate,
}: {
  template: DiagramTemplate
  onStartTemplate: (templateId: DiagramTemplateId) => void
}) {
  const Icon = templateIcons[template.id]

  return (
    <button
      type="button"
      className="template-button"
      aria-label={`${template.title} ${template.typeLabel}`}
      onClick={() => onStartTemplate(template.id)}
    >
      <Icon size={18} />
      <span>
        <strong>{template.title}</strong>
        <small>{template.typeLabel}</small>
      </span>
      <p>{template.prompt}</p>
    </button>
  )
}
