import type { ReactNode } from "react"

export default function CosmosDecorator({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        color: "#000",
      }}
    >
      {children}
    </div>
  )
}
