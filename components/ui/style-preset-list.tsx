"use client"

export interface StylePreset {
  id: string
  name: string
  emoji: string
  description: string
}

interface StylePresetListProps {
  presets: StylePreset[]
  selectedStyle: string
  onStyleSelect: (styleId: string) => void
}

export function StylePresetList({ presets, selectedStyle, onStyleSelect }: StylePresetListProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-semibold mb-2">Step 2: Choose Your Style</h3>
        <p className="text-muted-foreground">Select the artistic style for your family photo</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {presets.map((style) => (
          <button
            key={style.id}
            {...(process.env.NODE_ENV !== "production" ? { "data-testid": `style-option-${style.id}` } : {})}
            onClick={() => onStyleSelect(style.id)}
            className={`p-8 rounded-3xl glass text-center transition-all hover:scale-105 ${
              selectedStyle === style.id ? "ring-2 ring-primary shadow-xl" : ""
            }`}
          >
            <div className="text-5xl mb-3">{style.emoji}</div>
            <div className="text-xl font-semibold mb-2">{style.name}</div>
            <p className="text-sm text-muted-foreground">{style.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

