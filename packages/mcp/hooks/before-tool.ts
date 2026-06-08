// before_tool.ts
export function beforeToolCall(toolName: string, inputs: unknown) {
  console.log(`[AUDIT] Tool called: ${toolName}`, inputs)
  // add permission checks here later
}