"use client"

export interface Template {
  id: string
  name: string
  emoji: string
  description: string
}

interface TemplatePickerProps {
  templates: Template[]
  selectedTemplate: string
  onTemplateSelect: (templateId: string) => void
}

export function TemplatePicker({ templates, selectedTemplate, onTemplateSelect }: TemplatePickerProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-semibold mb-2">Step 3: Choose a Template Collection</h3>
        <p className="text-muted-foreground">Pick the perfect occasion for your family moment</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <button
            key={template.id}
            {...(process.env.NODE_ENV !== "production" ? { "data-testid": `template-option-${template.id}` } : {})}
            onClick={() => onTemplateSelect(template.id)}
            className={`p-8 rounded-3xl glass text-center transition-all hover:scale-105 ${
              selectedTemplate === template.id ? "ring-2 ring-primary shadow-xl" : ""
            }`}
          >
            <div className="text-5xl mb-3">{template.emoji}</div>
            <div className="text-xl font-semibold mb-2">{template.name}</div>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

