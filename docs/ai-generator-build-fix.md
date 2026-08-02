# AI generator build fix

The AI team graphic headers object is explicitly typed as `Record<string, string>` so the production TypeScript build accepts both authenticated and empty header states.
