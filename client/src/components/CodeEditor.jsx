import Editor from "@monaco-editor/react";
import { useRef, useCallback } from "react";

const LANGUAGE_MAP = {
  python: "python",
  java: "java",
  c: "c",
};

export default function CodeEditor({
  language,
  locked,
  onCodeChange,
  code,
  round,
}) {
  const editorRef = useRef(null);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          filter: "none",
          transition: "filter 0.3s ease",
        }}
      >
        <Editor
          height="100%"
          language={LANGUAGE_MAP[language] || "python"}
          theme="vs"
          value={code}
          onChange={(value) => onCodeChange(value || "")}
          onMount={handleEditorMount}
          options={{
            readOnly: locked,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            cursorStyle: "line",
            cursorWidth: 2,
            renderLineHighlight: "all",
            selectionHighlight: true,
            occurrencesHighlight: true,
            contextmenu: false,
            minimap: { enabled: false },
            glyphMargin: false,
            folding: true,
            cursorBlinking: "blink",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, left: 0 },
            suggest: { showWords: false },
            wordWrap: "on",
          }}
        />
      </div>

      <style>{`
        .monaco-editor .cursor {
          background-color: #818cf8 !important;
          border-color: #818cf8 !important;
          box-shadow: 0 0 10px rgba(99,102,241,0.8) !important;
          z-index: 100 !important;
          opacity: 1 !important;
        }
        .monaco-editor .cursors-layer {
          z-index: 100 !important;
        }
      `}</style>
    </div>
  );
}
