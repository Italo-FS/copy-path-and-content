import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.copyPathAndContent",
    async (fileUri: vscode.Uri, selectedUris: vscode.Uri[] | undefined) => {
      try {
        const uris = resolveSelectedUris(fileUri, selectedUris);

        if (uris.length === 0) {
          vscode.window.showErrorMessage("No file or folder selected.");
          return;
        }

        const outputs: string[] = [];

        for (const uri of uris) {
          const stat = await fs.stat(uri.fsPath);

          if (stat.isDirectory()) {
            outputs.push(await processDirectory(uri.fsPath));
          } else {
            outputs.push(await processSingleFile(uri.fsPath));
          }
        }

        const finalOutput = outputs.join("\n\n");

        await vscode.env.clipboard.writeText(finalOutput);

        vscode.window.showInformationMessage(
          uris.length > 1
            ? "Multiple items copied!"
            : "Path + content copied!"
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Ensures correct URIs array for: 
 * - single file
 * - multi-selected files
 * - folder
 */
function resolveSelectedUris(
  fileUri: vscode.Uri,
  selectedUris?: vscode.Uri[]
): vscode.Uri[] {
  if (selectedUris && selectedUris.length > 0) {
    return selectedUris;
  }

  if (fileUri) return [fileUri];

  const active = vscode.window.activeTextEditor?.document.uri;
  return active ? [active] : [];
}

/**
 * Process a single file
 */
async function processSingleFile(filePath: string): Promise<string> {
  const relative = getRelativePath(filePath);
  const content = await fs.readFile(filePath, "utf8");

  return `//${relative}\n${content}`;
}

/**
 * Process all recursively inside a folder
 */
async function processDirectory(folderPath: string): Promise<string> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  const outputs: string[] = [];

  for (const entry of entries) {
    const full = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      outputs.push(await processDirectory(full));
    } else {
      outputs.push(await processSingleFile(full));
    }
  }

  return outputs.join("\n\n");
}

/**
 * Workspace-relative path
 */
function getRelativePath(absolutePath: string): string {
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspace) return path.basename(absolutePath);

  return path.relative(workspace, absolutePath).replace(/\\/g, "/");
}

export function deactivate() {}
