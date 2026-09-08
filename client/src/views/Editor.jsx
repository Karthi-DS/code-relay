import Editor from "@monaco-editor/react";

export default function CodeEditor({ mode }) {
  const isBlur = mode === "BLUR";
  const isBlackout = mode === "BLACKOUT";

  return (
    <div className={`h-screen ${isBlackout && "bg-black text-black"}`}>
      <div>
        <Editor
          theme="vs-dark"
          height="90vh"
          options={{
            minimap: { enabled: false },
            renderLineHighlight: isBlackout ? "none" : "all",
          }}
        />
      </div>
    </div>
  );
}
