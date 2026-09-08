import Editor from "@monaco-editor/react";
import { useRef, useCallback } from "react";

const LANGUAGE_MAP = {
  python: "python",
  javascript: "javascript",
  c: "c",
  cpp: "cpp",
  java: "java",
};

export default function CodeEditor({
  language,
  locked,
  onCodeChange,
  code,
  round,
}) {
  const isRound1 = round === 1;
  const isRound2 = round === 2;
  const editorRef = useRef(null);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;

    // Disable copy-paste for blind coding
    editor.onKeyDown((e) => {
      if ((e.ctrlKey || e.metaKey) && (e.keyCode === 33 /* C */ || e.keyCode === 52 /* V */)) {
        e.preventDefault();
      }

      // Block backspace for round 2
      if (isRound2 && e.browserEvent.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Block cursor selection in round 2
    editor.onDidChangeCursorSelection((e) => {
      if (
        isRound2 &&
        (e.selection.startLineNumber !== e.selection.endLineNumber ||
          e.selection.startColumn !== e.selection.endColumn)
      ) {
        editor.setPosition({
          lineNumber: e.selection.endLineNumber,
          column: e.selection.endColumn,
        });
      }
    });
  }, [isRound2]);

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
          language={isRound2 ? "plaintext" : LANGUAGE_MAP[language] || "python"}
          theme="vs"
          value={code}
          onChange={(value) => onCodeChange(value || "")}
          onMount={handleEditorMount}
          options={{
            readOnly: locked,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            cursorStyle: isRound2 ? "block" : "line",
            cursorWidth: isRound2 ? 3 : 2,
            renderLineHighlight: isRound2 ? "none" : "all",
            selectionHighlight: !isRound2,
            occurrencesHighlight: !isRound2,
            contextmenu: false,
            minimap: { enabled: false },
            glyphMargin: false,
            folding: !isRound2,
            cursorBlinking: isRound2 ? "smooth" : "blink",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, left: 0 },
            suggest: { showWords: false },
            wordWrap: "on",
          }}
        />
      </div>

      {(isRound1 || isRound2) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(circle at center, transparent 0%, rgba(99,102,241,0.05) 100%)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

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
