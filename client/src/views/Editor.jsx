import Editor from "@monaco-editor/react";

export default function CodeEditor() {
  return (
    <div className="h-screen">
      <div>
        <Editor
          theme="vs-dark"
          height="90vh"
          options={{
            minimap: { enabled: false },
            renderLineHighlight: "all",
          }}
        />
      </div>
    </div>
  );
}
