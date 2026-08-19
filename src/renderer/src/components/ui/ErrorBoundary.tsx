import { Component, ErrorInfo, ReactNode } from 'react'
import { Card } from './Card'
import { Button } from './Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in UI Component:', error, errorInfo)
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Card className="m-6 p-6 border-red-800/80 bg-red-950/20 text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h3 className="text-lg font-bold text-red-400 m-0">
            Ocurrió un error inesperado en la interfaz
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto font-mono bg-zinc-950 p-3 rounded border border-zinc-800">
            {this.state.error?.message || 'Error de renderizado.'}
          </p>
          <Button
            variant="primary"
            onClick={(): void => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            🔄 Recargar Aplicación
          </Button>
        </Card>
      )
    }

    return this.props.children
  }
}
