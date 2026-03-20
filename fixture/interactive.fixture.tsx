import { IntraNodeSolverWithJumpers } from "@tscircuit/capacity-autorouter"
import { mergeGraphics, type GraphicsObject } from "graphics-debug"
import { InteractiveGraphics } from "graphics-debug/react"
import type { ChangeEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { getIntraNodeCrossingsUsingCircle } from "../script/calculate-mse-core"

type PortPoint = {
  x: number
  y: number
  z: number
  connectionName: string
}

type NodeWithPortPoints = {
  capacityMeshNodeId: string
  center: { x: number; y: number }
  width: number
  height: number
  portPoints: PortPoint[]
  availableZ?: number[]
}

type ProblemModule = {
  default: NodeWithPortPoints
}

const problemModules = import.meta.glob<ProblemModule>("../hg-problem/*.json", {
  eager: true,
})

const problemEntries = Object.entries(problemModules)
  .map(([path, mod]) => {
    const match = path.match(/\/(\d+)\.json$/)
    if (!match) return null
    return {
      id: Number(match[1]),
      problem: mod.default,
    }
  })
  .filter((entry): entry is { id: number; problem: NodeWithPortPoints } =>
    Boolean(entry),
  )
  .sort((a, b) => a.id - b.id)

const minProblemId = problemEntries[0]?.id ?? 1
const maxProblemId = problemEntries.at(-1)?.id ?? minProblemId
const problemMap = new Map(problemEntries.map((entry) => [entry.id, entry.problem]))

const normalizeProblem = (problem: NodeWithPortPoints): NodeWithPortPoints => {
  const rectCenterX = problem.center.x
  const rectCenterY = problem.center.y

  return {
    ...problem,
    center: { x: 0, y: 0 },
    portPoints: problem.portPoints.map((portPoint) => ({
      ...portPoint,
      x: portPoint.x - rectCenterX,
      y: portPoint.y - rectCenterY,
    })),
  }
}



const getRawMetrics = (problem: NodeWithPortPoints) => {
  const normalizedProblem = normalizeProblem(problem)
  const xmin = normalizedProblem.center.x - normalizedProblem.width / 2
  const xmax = normalizedProblem.center.x + normalizedProblem.width / 2
  const ymin = normalizedProblem.center.y - normalizedProblem.height / 2
  const ymax = normalizedProblem.center.y + normalizedProblem.height / 2

  const stats = getIntraNodeCrossingsUsingCircle(problem)

  return {
    width: normalizedProblem.width,
    height: normalizedProblem.height,
    availableZ: normalizedProblem.availableZ ?? [0, 1],
    layerCount: normalizedProblem.availableZ?.length ?? 2,
    numPortPoints: normalizedProblem.portPoints.length,
    numSameLayerCrossings: stats.numSameLayerCrossings,
    numEntryExitLayerChanges: stats.numEntryExitLayerChanges,
    numTransitionPairCrossings: stats.numTransitionPairCrossings,
  }
}

const getInitialGraphics = (problem: NodeWithPortPoints) => {
  const normalizedProblem = normalizeProblem(problem)
  const solver = new IntraNodeSolverWithJumpers({
    nodeWithPortPoints: normalizedProblem,
  })

  return solver.visualize()
}

export default function InteractiveFixture() {
  const [problemInput, setProblemInput] = useState(String(minProblemId))
  const [graphics, setGraphics] = useState<GraphicsObject>(() =>
    getInitialGraphics(problemMap.get(minProblemId)!),
  )
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle")
  const [statusText, setStatusText] = useState("Initial visualization")

  const animationRef = useRef<number | null>(null)
  const solverRef = useRef<IntraNodeSolverWithJumpers | null>(null)

  const selectedProblemId = Number(problemInput)
  const selectedProblem = problemMap.get(selectedProblemId)
  const rawMetrics = selectedProblem ? getRawMetrics(selectedProblem) : null

  const stopAnimation = () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }

  useEffect(() => {
    stopAnimation()
    solverRef.current = null

    if (!selectedProblem) {
      setRunState("idle")
      setStatusText(`Problem ${problemInput || "?"} not found`)
      setGraphics({ lines: [], points: [], rects: [], circles: [] })
      return
    }

    setRunState("idle")
    setStatusText("Initial visualization")
    setGraphics(getInitialGraphics(selectedProblem))
  }, [problemInput, selectedProblem])

  useEffect(() => stopAnimation, [])

  const startRun = () => {
    if (!selectedProblem) return

    stopAnimation()

    const normalizedProblem = normalizeProblem(selectedProblem)
    const solver = new IntraNodeSolverWithJumpers({
      nodeWithPortPoints: normalizedProblem,
    })

    solverRef.current = solver
    setRunState("running")

    const animate = () => {
      const currentSolver = solverRef.current
      if (!currentSolver) return

      if (!currentSolver.solved && !currentSolver.failed) {
        currentSolver.step()
      }

      const nextGraphics =
        currentSolver.solved || currentSolver.failed
          ? currentSolver.visualize()
          : mergeGraphics({}, currentSolver.visualize())

      setGraphics(nextGraphics)

      const solvedCount = currentSolver.solvedRoutes.length
      setStatusText(`${solvedCount} / ${currentSolver.totalConnections} solved`)

      if (currentSolver.solved || currentSolver.failed) {
        setRunState("done")
        animationRef.current = null
        return
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
  }

  const resetToInitial = () => {
    stopAnimation()
    solverRef.current = null

    if (!selectedProblem) return

    setRunState("idle")
    setStatusText("Initial visualization")
    setGraphics(getInitialGraphics(selectedProblem))
  }

  return (
    <div
      style={{
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          border: "1px solid #000",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Problem ID
            <input
              type="number"
              min={minProblemId}
              max={maxProblemId}
              step={1}
              value={problemInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setProblemInput(event.target.value)
              }
              style={{
                width: 120,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #000",
                background: "#fff",
                color: "#000",
                font: "inherit",
              }}
            />
          </label>

          <button
            type="button"
            onClick={startRun}
            disabled={!selectedProblem || runState === "running"}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #000",
              background: "#fff",
              color: "#000",
              fontWeight: 600,
              cursor: runState === "running" ? "progress" : "pointer",
              opacity: runState === "running" ? 0.6 : 1,
            }}
          >
            Run
          </button>

          <button
            type="button"
            onClick={resetToInitial}
            disabled={!selectedProblem}
            style={{
              padding: "8px 14px",
              border: "1px solid #000",
              background: "#fff",
              color: "#000",
              fontWeight: 600,
              cursor: selectedProblem ? "pointer" : "not-allowed",
            }}
          >
            Reset
          </button>

          <div style={{ fontSize: 13, color: "#000" }}>
            Range {minProblemId} to {maxProblemId}
          </div>
          <div style={{ fontSize: 13, color: "#000" }}>{statusText}</div>
        </div>

        {selectedProblem && rawMetrics && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 8,
              fontSize: 13,
            }}
          >
            {[
              ["Node", selectedProblem.capacityMeshNodeId],
              ["Available Z", rawMetrics.availableZ.join(", ")],
              ["Layer Count", String(rawMetrics.layerCount)],
              ["Width", String(rawMetrics.width)],
              ["Height", String(rawMetrics.height)],
              ["Port Points", String(rawMetrics.numPortPoints)],
              ["Same Layer Crossings", String(rawMetrics.numSameLayerCrossings)],
              [
                "Entry/Exit Layer Changes",
                String(rawMetrics.numEntryExitLayerChanges),
              ],
              [
                "Transition Pair Crossings",
                String(rawMetrics.numTransitionPairCrossings),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid #000",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>{label}</div>
                <div>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid #000",
          borderRadius: 12,
          background: "#fff",
          minHeight: 720,
          overflow: "hidden",
        }}
      >
        <InteractiveGraphics graphics={graphics} />
      </div>
    </div>
  )
}
