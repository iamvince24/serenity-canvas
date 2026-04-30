import TaskItem from "@tiptap/extension-task-item";
import { TextSelection } from "@tiptap/pm/state";

export const TaskItemWithBackspaceBehavior = TaskItem.extend({
  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {};

    const findTaskItemDepth = (from: TextSelection["$from"]) => {
      let taskItemDepth = from.depth;
      while (
        taskItemDepth > 0 &&
        from.node(taskItemDepth).type.name !== "taskItem"
      ) {
        taskItemDepth -= 1;
      }

      return taskItemDepth;
    };

    const removeEmptyTaskItem = () =>
      this.editor.commands.command(({ tr, state, dispatch }) => {
        const { selection } = state;
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        if (
          $from.parent.type.name !== "paragraph" ||
          $from.parentOffset !== 0
        ) {
          return false;
        }

        const taskItemDepth = findTaskItemDepth($from);
        if (taskItemDepth === 0) {
          return false;
        }

        const taskItemNode = $from.node(taskItemDepth);
        if (taskItemNode.textContent.length > 0) {
          return false;
        }

        const taskListDepth = taskItemDepth - 1;
        if (taskListDepth <= 0) {
          return false;
        }

        const indexInTaskList = $from.index(taskListDepth);
        if (indexInTaskList <= 0) {
          return false;
        }

        const taskItemPos = $from.before(taskItemDepth);
        tr.delete(taskItemPos, taskItemPos + taskItemNode.nodeSize);

        const previousItemEndPos = Math.max(1, taskItemPos - 1);
        tr.setSelection(
          TextSelection.near(tr.doc.resolve(previousItemEndPos), -1),
        );

        dispatch?.(tr.scrollIntoView());
        return true;
      });

    const deleteToLineStartInTaskItem = () =>
      this.editor.commands.command(({ tr, state, dispatch }) => {
        const { selection } = state;
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        if ($from.parent.type.name !== "paragraph") {
          return false;
        }

        const taskItemDepth = findTaskItemDepth($from);
        if (taskItemDepth === 0) {
          return false;
        }

        if ($from.parentOffset <= 0) {
          return false;
        }

        const paragraphStart = $from.start();
        tr.delete(paragraphStart, $from.pos);
        dispatch?.(tr.scrollIntoView());
        return true;
      });

    return {
      ...parentShortcuts,
      "Mod-Backspace": () =>
        deleteToLineStartInTaskItem() || removeEmptyTaskItem(),
      "Mod-Delete": () =>
        deleteToLineStartInTaskItem() || removeEmptyTaskItem(),
      Backspace: () => removeEmptyTaskItem(),
      Delete: () => removeEmptyTaskItem(),
    };
  },
}).configure({ nested: true });
