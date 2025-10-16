"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Copy,
  Columns3,
  Download,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type QuestionType = "LIKERT" | "YES_NO" | "TEXT" | "SHORT_TEXT";
type SurveyStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";

const FIXED_OPTION_SETS: Record<Extract<QuestionType, "LIKERT" | "YES_NO">, { value: string; label: string }[]> = {
  LIKERT: [
    { value: "1", label: "Extremely Dissatisfied" },
    { value: "2", label: "Dissatisfied" },
    { value: "3", label: "Satisfied" },
    { value: "4", label: "Extremely Satisfied" },
  ],
  YES_NO: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],
};

const MULTICHOICE_TYPES: QuestionType[] = ["LIKERT", "YES_NO"];

type SurveyMeta = {
  id: number;
  title: string;
  version: number;
  status: SurveyStatus;
  submitted_by: { id: number; name: string; email: string } | null;
  submitted_for_review_at: string | null;
};

type ServerQuestion = {
  question_id: number;
  display_order: number;
  question_key: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  help_text: string | null;
  options: { option_id: number; option_value: string; label: string }[];
};

type BuilderPayload = {
  working: { survey: SurveyMeta; questions: ServerQuestion[] } | null;
  latestPublished: {
    survey: SurveyMeta;
    questions: ServerQuestion[];
    questionKeys: string[];
  } | null;
};

type QuestionDraft = {
  id: string;
  sourceQuestionId: number | null;
  displayOrder: number;
  questionKey: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  helpText: string;
  initialKey: string;
};

type SortColumn = "displayOrder" | "questionKey" | "prompt" | "type" | "required";
type SortState = { column: SortColumn; direction: "asc" | "desc" } | null;

type ColumnId =
  | "displayOrder"
  | "questionKey"
  | "prompt"
  | "type"
  | "required"
  | "helpText";

type ColumnConfig = {
  id: ColumnId;
  label: string;
  widthClass?: string;
  align?: "left" | "center";
};

const COLUMNS: ColumnConfig[] = [
  { id: "displayOrder", label: "#", widthClass: "w-16", align: "center" },
  { id: "questionKey", label: "Key", widthClass: "w-48" },
  { id: "prompt", label: "Prompt", widthClass: "min-w-[280px]" },
  { id: "type", label: "Type", widthClass: "w-40" },
  { id: "required", label: "Required", widthClass: "w-28", align: "center" },
  { id: "helpText", label: "Help Text", widthClass: "min-w-[220px]" },
];

function generateTempId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapServerQuestion(row: ServerQuestion): QuestionDraft {
  return {
    id: generateTempId(),
    sourceQuestionId: row.question_id,
    displayOrder: row.display_order,
    questionKey: row.question_key,
    prompt: row.prompt,
    type: row.type,
    required: row.required,
    helpText: row.help_text ?? "",
    initialKey: row.question_key,
  };
}

function cloneFromPublished(row: ServerQuestion): QuestionDraft {
  return {
    id: generateTempId(),
    sourceQuestionId: null,
    displayOrder: row.display_order,
    questionKey: row.question_key,
    prompt: row.prompt,
    type: row.type,
    required: MULTICHOICE_TYPES.includes(row.type) ? true : row.required,
    helpText: row.help_text ?? "",
    initialKey: row.question_key,
  };
}

function renumber(questions: QuestionDraft[]): QuestionDraft[] {
  return questions
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((question, index) => ({
      ...question,
      displayOrder: index + 1,
    }));
}

type ValidationField = "questionKey" | "prompt" | "displayOrder" | "required";
type ValidationState = {
  global: string[];
  fields: Record<string, Partial<Record<ValidationField, string>>>;
};

function computeValidation(questions: QuestionDraft[]): ValidationState {
  const global: string[] = [];
  const fields: ValidationState["fields"] = {};

  if (!questions.length) {
    global.push("Add at least one question.");
    return { global, fields };
  }

  const keySet = new Map<string, string>();
  const orderSet = new Set<number>();

  for (const question of questions) {
    const trimmedKey = question.questionKey.trim();
    const trimmedPrompt = question.prompt.trim();

    const fieldErrors: Partial<Record<ValidationField, string>> = {};

    if (!trimmedKey) {
      fieldErrors.questionKey = "Key is required.";
    } else {
      const lower = trimmedKey.toLowerCase();
      if (keySet.has(lower) && keySet.get(lower) !== question.id) {
        fieldErrors.questionKey = "Key must be unique.";
      } else {
        keySet.set(lower, question.id);
      }
    }

    if (!trimmedPrompt) {
      fieldErrors.prompt = "Prompt is required.";
    }

    const order = Number(question.displayOrder);
    if (!Number.isInteger(order) || order < 1) {
      fieldErrors.displayOrder = "Order must be 1..N.";
    } else if (orderSet.has(order)) {
      fieldErrors.displayOrder = "Order must be unique.";
    } else {
      orderSet.add(order);
    }

    if (MULTICHOICE_TYPES.includes(question.type) && !question.required) {
      fieldErrors.required = "Required for this type.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      fields[question.id] = fieldErrors;
    }
  }

  for (let idx = 1; idx <= questions.length; idx += 1) {
    if (!orderSet.has(idx)) {
      global.push("Display order must be contiguous (1..N).");
      break;
    }
  }

  return { global, fields };
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildCsv(columns: ColumnConfig[], rows: QuestionDraft[]): string {
  const header = columns.map((column) => column.label);
  const data = rows.map((row) =>
    columns.map((column) => {
      let raw = "";
      switch (column.id) {
        case "displayOrder":
          raw = String(row.displayOrder);
          break;
        case "questionKey":
          raw = row.questionKey;
          break;
        case "prompt":
          raw = row.prompt;
          break;
        case "type":
          raw = row.type;
          break;
        case "required":
          raw = row.required ? "Yes" : "No";
          break;
        case "helpText":
          raw = row.helpText;
          break;
        default:
          raw = "";
      }
      const escaped = raw.replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    })
  );
  return [header.join(","), ...data.map((row) => row.join(","))].join("\r\n");
}

type EntryChoice = "create" | "edit";
type ActiveSurvey =
  | {
      status: "PENDING_REVIEW";
      surveyId: number;
      title: string;
      submittedAt: string | null;
      submittedBy: string | null;
    }
  | {
      status: "DRAFT";
      surveyId: number;
      title: string;
    }
  | {
      status: "LOCAL";
      surveyId: null;
      title: string;
    };
type PendingConfirm =
  | { kind: "mode-switch"; mode: EntryChoice }
  | { kind: "mode-reset" }
  | { kind: "type-change"; questionId: string; newType: QuestionType };

export type QuestionsBuilderProps = {
  highlightRows?: boolean;
};

export default function QuestionsBuilder({ highlightRows = true }: QuestionsBuilderProps) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [payload, setPayload] = React.useState<BuilderPayload | null>(null);
  const [entryChoice, setEntryChoice] = React.useState<EntryChoice | null>(null);
  const [questions, setQuestions] = React.useState<QuestionDraft[]>([]);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortState>(null);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<ColumnId, boolean>>({
    displayOrder: true,
    questionKey: true,
    prompt: true,
    type: true,
    required: true,
    helpText: true,
  });
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationState>({ global: [], fields: {} });
  const [hasChanges, setHasChanges] = React.useState(false);
  const [activeSurvey, setActiveSurvey] = React.useState<ActiveSurvey | null>(null);
  const [publishedKeySet, setPublishedKeySet] = React.useState<Set<string>>(new Set());
  const [exportConfirmOpen, setExportConfirmOpen] = React.useState(false);
  const [exportStep, setExportStep] = React.useState<1 | 2>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null);

  const { markDirty, markPristine } = useUnsavedChanges();
  const selectionNeeded = entryChoice === null;
  const noPublishedAvailable = payload ? !payload.latestPublished : false;
  React.useEffect(() => {
    if (!hasChanges) markPristine();
    else markDirty();
  }, [hasChanges, markDirty, markPristine]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/questions/question-builder", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as BuilderPayload;
      setPayload(json);
      const publishedKeys = json.latestPublished?.questionKeys ?? [];
      setPublishedKeySet(new Set(publishedKeys.map((key) => key.toLowerCase())));
    } catch (error) {
      console.error("Failed to load questions builder", error);
      toast.error("Unable to load the questions builder. Please refresh.");
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (entryChoice !== null) return;
    if (!payload) return;
    if (payload.working) {
      setEntryChoice("edit");
    }
  }, [entryChoice, payload]);

  const hydrateFromChoice = React.useCallback(
    (choice: EntryChoice, data: BuilderPayload | null) => {
      if (!data) return;
      setAttemptedSubmit(false);
      setValidation({ global: [], fields: {} });
      setHasChanges(false);
      setSearch("");

      if (choice === "create") {
        const fallbackTitle =
          data.latestPublished?.survey.title ??
          data.working?.survey.title ??
          "Survey Form";
        setQuestions([]);
        setActiveSurvey({
          status: "LOCAL",
          surveyId: null,
          title: fallbackTitle,
        });
        return;
      }

      if (data.working) {
        const mapped = data.working.questions.map(mapServerQuestion);
        setQuestions(renumber(mapped));
        const survey = data.working.survey;
        if (survey.status === "PENDING_REVIEW") {
          setActiveSurvey({
            status: "PENDING_REVIEW",
            surveyId: survey.id,
            title: survey.title,
            submittedAt: survey.submitted_for_review_at,
            submittedBy: survey.submitted_by?.name ?? null,
          });
        } else {
          setActiveSurvey({
            status: "DRAFT",
            surveyId: survey.id,
            title: survey.title,
          });
        }
        return;
      }

      if (data.latestPublished) {
        const cloned = data.latestPublished.questions.map(cloneFromPublished);
        setQuestions(renumber(cloned));
        setActiveSurvey({
          status: "LOCAL",
          surveyId: null,
          title: data.latestPublished.survey.title,
        });
      } else {
        setQuestions([]);
        setActiveSurvey({ status: "LOCAL", surveyId: null, title: "Survey Form" });
      }
    },
    []
  );

  React.useEffect(() => {
    if (!entryChoice || !payload) return;
    hydrateFromChoice(entryChoice, payload);
  }, [entryChoice, payload, hydrateFromChoice]);

  const filteredQuestions = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    let base = questions.slice();
    if (term) {
      base = base.filter((question) => {
        const haystack = [
          question.questionKey,
          question.prompt,
          question.helpText,
          question.type,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    if (!sort) return base;
    return base.slice().sort((a, b) => {
      let result = 0;
      switch (sort.column) {
        case "displayOrder":
          result = a.displayOrder - b.displayOrder;
          break;
        case "questionKey":
          result = a.questionKey.localeCompare(b.questionKey);
          break;
        case "prompt":
          result = a.prompt.localeCompare(b.prompt);
          break;
        case "type":
          result = a.type.localeCompare(b.type);
          break;
        case "required":
          result = Number(a.required) - Number(b.required);
          break;
        default:
          result = 0;
      }
      return sort.direction === "asc" ? result : -result;
    });
  }, [questions, search, sort]);

  const visibleColumnCount = React.useMemo(
    () => Object.values(visibleColumns).filter(Boolean).length,
    [visibleColumns]
  );

  const builderLocked = activeSurvey?.status === "PENDING_REVIEW";
  const canEdit = !builderLocked;

  const rememberChoice = React.useCallback(
    async (choice: EntryChoice) => {
      setEntryChoice(choice);
      try {
        await fetch("/api/admin/questions/question-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: "draft_edit" }),
        });
      } catch {
        /* best-effort audit */
      }
    },
    []
  );

  const resetModeState = React.useCallback(() => {
    setEntryChoice(null);
    setActiveSurvey(null);
    setQuestions([]);
    setValidation({ global: [], fields: {} });
    setAttemptedSubmit(false);
    setHasChanges(false);
  }, []);

  const handleModeSelect = React.useCallback(
    (mode: EntryChoice) => {
      if (builderLocked) return;
      if (mode === "create" && noPublishedAvailable) return;
      if (entryChoice === mode && !selectionNeeded) return;
      if (hasChanges && !builderLocked) {
        setPendingConfirm({ kind: "mode-switch", mode });
        return;
      }
      void rememberChoice(mode);
    },
    [builderLocked, entryChoice, hasChanges, noPublishedAvailable, rememberChoice, selectionNeeded]
  );

  const handleResetMode = React.useCallback(() => {
    if (builderLocked) return;
    if (!selectionNeeded && hasChanges && !builderLocked) {
      setPendingConfirm({ kind: "mode-reset" });
      return;
    }
    resetModeState();
  }, [builderLocked, hasChanges, resetModeState, selectionNeeded]);

  const addQuestion = React.useCallback(() => {
    if (!canEdit) return;
    setQuestions((prev) => {
      const nextOrder = prev.length + 1;
      const next: QuestionDraft = {
        id: generateTempId(),
        sourceQuestionId: null,
        displayOrder: nextOrder,
        questionKey: `question_${nextOrder}`,
        prompt: "",
        type: "TEXT",
        required: false,
        helpText: "",
        initialKey: "",
      };
      setHasChanges(true);
      return [...prev, next];
    });
  }, [canEdit]);

  const duplicateQuestion = React.useCallback(
    (question: QuestionDraft) => {
      if (!canEdit) return;
      setQuestions((prev) => {
        const clone: QuestionDraft = {
          ...question,
          id: generateTempId(),
          sourceQuestionId: null,
          questionKey: `${question.questionKey}_copy`,
          displayOrder: prev.length + 1,
          initialKey: question.initialKey,
        };
        setHasChanges(true);
        return renumber([...prev, clone]);
      });
    },
    [canEdit]
  );

  const removeQuestion = React.useCallback(
    (id: string) => {
      if (!canEdit) return;
      setQuestions((prev) => {
        const filtered = prev.filter((question) => question.id !== id);
        setHasChanges(true);
        return renumber(filtered);
      });
    },
    [canEdit]
  );

  const moveQuestionToIndex = React.useCallback(
    (id: string, targetIndex: number) => {
      if (!canEdit) return;
      setQuestions((prev) => {
        const ordered = renumber(prev);
        const index = ordered.findIndex((question) => question.id === id);
        if (index === -1) return prev;
        const boundedIndex = Math.max(0, Math.min(targetIndex, ordered.length - 1));
        const working = ordered.slice();
        const [item] = working.splice(index, 1);
        working.splice(boundedIndex, 0, item);
        setHasChanges(true);
        return renumber(working);
      });
    },
    [canEdit]
  );

  const updateQuestion = React.useCallback(
    (id: string, updater: (question: QuestionDraft) => QuestionDraft) => {
      if (!canEdit) return;
      setQuestions((prev) => {
        const next = prev.map((question) => (question.id === id ? updater(question) : question));
        if (next !== prev) setHasChanges(true);
        return next;
      });
    },
    [canEdit]
  );

  const applyTypeChange = React.useCallback(
    (questionId: string, newType: QuestionType) => {
      updateQuestion(questionId, (existing) => {
        if (existing.type === newType) return existing;
        if (MULTICHOICE_TYPES.includes(newType)) {
          return {
            ...existing,
            type: newType,
            required: true,
          };
        }
        return {
          ...existing,
          type: newType,
          required: false,
        };
      });
    },
    [updateQuestion]
  );

  const handleTypeChange = React.useCallback(
    (question: QuestionDraft, newType: QuestionType) => {
      if (question.type === newType) return;
      if (MULTICHOICE_TYPES.includes(question.type) && !MULTICHOICE_TYPES.includes(newType)) {
        setPendingConfirm({ kind: "type-change", questionId: question.id, newType });
        return;
      }
      applyTypeChange(question.id, newType);
    },
    [applyTypeChange]
  );

  const handleConfirmProceed = React.useCallback(() => {
    if (!pendingConfirm) return;
    switch (pendingConfirm.kind) {
      case "mode-switch":
        void rememberChoice(pendingConfirm.mode);
        break;
      case "mode-reset":
        resetModeState();
        break;
      case "type-change":
        applyTypeChange(pendingConfirm.questionId, pendingConfirm.newType);
        break;
      default:
        break;
    }
    setPendingConfirm(null);
  }, [applyTypeChange, pendingConfirm, rememberChoice, resetModeState]);

  const handleConfirmOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setPendingConfirm(null);
      }
    },
    []
  );

  const confirmDialogDetails = React.useMemo(() => {
    if (!pendingConfirm) return null;
    if (pendingConfirm.kind === "type-change") {
      return {
        title: "Change question type?",
        description:
          "Switching from a fixed-choice question will discard its locked options and unlock the required setting. Continue?",
        actionLabel: "Continue",
      };
    }
    return {
      title: "Discard unsaved edits?",
      description: "Switching modes will discard unsaved edits. Continue?",
      actionLabel: "Continue",
    };
  }, [pendingConfirm]);

  const onSubmit = React.useCallback(async () => {
    if (!entryChoice) {
      toast.error("Choose how you want to start before submitting.");
      return;
    }
    const validationResult = computeValidation(questions);
    setValidation(validationResult);
    setAttemptedSubmit(true);
    if (validationResult.global.length || Object.keys(validationResult.fields).length) {
      toast.error("Resolve the highlighted issues before submitting for review.");
      return;
    }

    if (!payload) {
      toast.error("No survey data loaded. Please refresh.");
      return;
    }

    const body = {
      intent: "submit",
      surveyId: activeSurvey?.status === "DRAFT" ? activeSurvey.surveyId : null,
      title: activeSurvey?.title ?? payload.latestPublished?.survey.title ?? null,
      questions: questions.map((question) => ({
        question_key: question.questionKey.trim(),
        prompt: question.prompt.trim(),
        type: question.type,
        required: MULTICHOICE_TYPES.includes(question.type) ? true : Boolean(question.required),
        help_text: question.helpText.trim() || null,
        display_order: question.displayOrder,
        options: MULTICHOICE_TYPES.includes(question.type)
          ? FIXED_OPTION_SETS[question.type as "LIKERT" | "YES_NO"].map((option) => ({
              option_value: option.value,
              label: option.label,
            }))
          : [],
      })),
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/questions/question-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        const message = json?.error ?? "Submission failed.";
        toast.error(message);
        return;
      }
      toast.success("Draft submitted for review.");
      setHasChanges(false);
      setAttemptedSubmit(false);
      setValidation({ global: [], fields: {} });
      await load();
    } catch (error) {
      console.error("Submit for review failed", error);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [entryChoice, questions, payload, activeSurvey, load]);

  const onExport = React.useCallback(async () => {
    const columns = COLUMNS.filter((column) => visibleColumns[column.id]);
    if (!columns.length) {
      toast.error("Select at least one column to export.");
      return;
    }
    const csv = buildCsv(columns, filteredQuestions);
    try {
      await fetch("/api/admin/questions/question-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "export" }),
      });
    } catch {
      /* ignore logging error */
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `questions-builder-${Date.now()}.csv`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Questions exported.");
  }, [filteredQuestions, visibleColumns]);

  const renderWarningForKey = (question: QuestionDraft) => {
    const trimmed = question.questionKey.trim().toLowerCase();
    if (!trimmed) return null;
    if (!publishedKeySet.has(trimmed)) return null;
    if (trimmed === question.initialKey.toLowerCase()) return null;
    return (
      <p className="mt-1 text-xs text-amber-600">
        This key exists in the latest published survey. Changing it may affect historical comparisons.
      </p>
    );
  };

  const renderValidationMessage = (questionId: string, field: ValidationField) => {
    if (!attemptedSubmit) return null;
    const fieldErrors = validation.fields[questionId];
    const message = fieldErrors?.[field];
    if (!message) return null;
    return <p className="mt-1 text-xs text-destructive">{message}</p>;
  };


    return (
    <Card className="md:col-span-8 rounded-xl border bg-card shadow-sm px-4">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="tracking-normal">Questions Builder</CardTitle>
          <CardDescription>
            Build and review survey questions locally. Drafts are not saved until you submit for review.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!selectionNeeded && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Mode:</span>
              <div className="inline-flex overflow-hidden rounded-md border bg-background shadow-sm">
                <Button
                  type="button"
                  size="sm"
                  variant={entryChoice === "edit" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-none px-3 text-xs font-medium",
                    "first:rounded-l-md last:rounded-r-md"
                  )}
                  disabled={builderLocked}
                  onClick={() => handleModeSelect("edit")}
                >
                  Edit Current
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={entryChoice === "create" ? "default" : "ghost"}
                  className={cn(
                    "h-8 rounded-none px-3 text-xs font-medium",
                    "first:rounded-l-md last:rounded-r-md"
                  )}
                  disabled={builderLocked || noPublishedAvailable}
                  title={
                    noPublishedAvailable
                      ? "A published survey is required before creating a new version."
                    : undefined
                  }
                  onClick={() => handleModeSelect("create")}
                >
                  Create New
                </Button>
              </div>
              {!builderLocked ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={handleResetMode}
                >
                  Change mode
                </button>
              ) : null}
            </div>
          )}

          {activeSurvey?.status === "PENDING_REVIEW" ? (
            <Badge variant="secondary">Pending review</Badge>
          ) : activeSurvey?.status === "DRAFT" ? (
            <Badge variant="outline">Draft in progress</Badge>
          ) : activeSurvey?.status === "LOCAL" ? (
            <Badge variant="outline">New version</Badge>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
          >
            {loading || refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-6">
        {!selectionNeeded && activeSurvey?.status === "PENDING_REVIEW" ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p>
                  Version under review. Submitted {formatSubmittedAt(activeSurvey.submittedAt)}{" "}
                  {activeSurvey.submittedBy ? `by ${activeSurvey.submittedBy}` : ""}.
                </p>
                <p>The builder is read-only until reviewers publish or return the draft.</p>
              </div>
            </div>
          </div>
        ) : null}

        {selectionNeeded ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Choose how you want to start the builder for this session.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => handleModeSelect("edit")}
                disabled={loading}
              >
                Edit the current survey form
              </Button>
              <Button
                size="lg"
                variant="default"
                onClick={() => handleModeSelect("create")}
                disabled={loading || noPublishedAvailable}
              >
                Create new survey form
              </Button>
            </div>
            {noPublishedAvailable ? (
              <p className="mt-4 text-xs text-muted-foreground">
                No published survey found yet. Start by editing the current draft.
              </p>
            ) : null}
          </div>
        ) : null}

        {!selectionNeeded && attemptedSubmit && (validation.global.length > 0 || Object.keys(validation.fields).length > 0) ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              Resolve the following before submitting:
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validation.global.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!selectionNeeded ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] sm:max-w-xs">
              <Filter className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-8"
                placeholder="Search questions..."
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                {COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visibleColumns[column.id]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [column.id]: Boolean(checked),
                      }))
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExportStep(1);
                setExportConfirmOpen(true);
              }}
              disabled={filteredQuestions.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button size="sm" onClick={addQuestion} disabled={!canEdit}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onSubmit}
              disabled={
                builderLocked ||
                submitting ||
                questions.length === 0 ||
                (!hasChanges && activeSurvey?.status === "LOCAL")
              }
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CircleCheck className="mr-2 h-4 w-4" />
              )}
              Submit for Review
            </Button>
          </div>
        ) : null}

        {!selectionNeeded ? (
          <div className="rounded-md border">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    {COLUMNS.filter((column) => visibleColumns[column.id]).map((column) => (
                      <th
                        key={column.id}
                        className={cn(
                          "border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          column.align === "center" && "text-center",
                          column.widthClass
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-1 text-left"
                          onClick={() => {
                            setSort((prev) => {
                              if (!prev || prev.column !== column.id) {
                                return { column: column.id as SortColumn, direction: "asc" };
                              }
                              if (prev.direction === "asc") {
                                return { column: column.id as SortColumn, direction: "desc" };
                              }
                              return null;
                            });
                          }}
                        >
                          <span>{column.label}</span>
                          {sort?.column === column.id ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : null}
                        </button>
                      </th>
                    ))}
                    <th className="w-44 border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={visibleColumnCount + 1} className="px-4 py-6 text-center text-muted-foreground">
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        Loading...
                      </td>
                    </tr>
                  ) : filteredQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumnCount + 1} className="px-4 py-6 text-center text-muted-foreground">
                        No questions match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredQuestions.map((question) => {
                      const fieldErrors = validation.fields[question.id];
                      const highlight = attemptedSubmit && fieldErrors && highlightRows;
                      const requiredId = `required-${question.id}`;
                      const isLockedRequired = MULTICHOICE_TYPES.includes(question.type);
                      return (
                        <tr
                          key={question.id}
                          className={cn(
                            "border-b align-top transition-colors odd:bg-muted/20 hover:bg-accent/30 focus-within:bg-muted/50",
                            highlight && "ring-1 ring-inset ring-destructive/40"
                          )}
                        >
                          {visibleColumns.displayOrder ? (
                            <td className="px-3 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <Input
                                  key={`${question.id}-${question.displayOrder}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={questions.length || 1}
                                  defaultValue={question.displayOrder}
                                  disabled={!canEdit}
                                  aria-label="Display order"
                                  onBlur={(event) => {
                                    const rawValue = event.currentTarget.value.trim();
                                    if (!rawValue) {
                                      event.currentTarget.value = String(question.displayOrder);
                                      return;
                                    }
                                    const parsed = Number.parseInt(rawValue, 10);
                                    if (!Number.isInteger(parsed)) {
                                      event.currentTarget.value = String(question.displayOrder);
                                      return;
                                    }
                                    const bounded = Math.max(1, Math.min(parsed, questions.length));
                                    event.currentTarget.value = String(bounded);
                                    if (bounded === question.displayOrder) {
                                      return;
                                    }
                                    moveQuestionToIndex(question.id, bounded - 1);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className={cn(
                                    "h-8 w-16 text-center border-2 border-primary/30 shadow-lg",
                                    attemptedSubmit && fieldErrors?.displayOrder
                                      ? "border-destructive focus-visible:ring-destructive"
                                      : ""
                                  )}
                                />
                                {renderValidationMessage(question.id, "displayOrder")}
                              </div>
                            </td>
                          ) : null}

                          {visibleColumns.questionKey ? (
                            <td className="px-3 py-3">
                              <Input
                                value={question.questionKey}
                                disabled={!canEdit}
                                placeholder="e.g., order_accuracy"
                                onChange={(event) =>
                                  updateQuestion(question.id, (existing) => ({
                                    ...existing,
                                    questionKey: event.target.value,
                                  }))
                                }
                                className={cn(
                                  "border-2 border-primary/30 shadow-lg",
                                  attemptedSubmit && fieldErrors?.questionKey
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                )}
                              />
                              {renderValidationMessage(question.id, "questionKey")}
                              {renderWarningForKey(question)}
                            </td>
                          ) : null}

                          {visibleColumns.prompt ? (
                            <td className="px-3 py-3">
                              <Textarea
                                value={question.prompt}
                                disabled={!canEdit}
                                placeholder="Type the question..."
                                onChange={(event) =>
                                  updateQuestion(question.id, (existing) => ({
                                    ...existing,
                                    prompt: event.target.value,
                                  }))
                                }
                                className={cn(
                                  "min-h-[72px] border-2 border-primary/30 shadow-lg",
                                  attemptedSubmit && fieldErrors?.prompt
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                )}
                              />
                              {renderValidationMessage(question.id, "prompt")}
                            </td>
                          ) : null}

                          {visibleColumns.type ? (
                            <td className="px-3 py-3">
                              <Select
                                value={question.type}
                                onValueChange={(value: QuestionType) => {
                                  if (!canEdit) return;
                                  handleTypeChange(question, value);
                                }}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="border-2 border-primary/30 shadow-lg">
                                  <SelectValue placeholder="Select a type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="LIKERT">Likert (fixed options)</SelectItem>
                                  <SelectItem value="YES_NO">Yes / No</SelectItem>
                                  <SelectItem value="TEXT">Text (long form)</SelectItem>
                                  <SelectItem value="SHORT_TEXT">Short text</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          ) : null}

                          {visibleColumns.required ? (
                            <td className="px-3 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <Checkbox
                                  className="border-2 border-primary/30 shadow-lg"
                                  id={requiredId}
                                  aria-label="Required question"
                                  checked={question.required}
                                  disabled={!canEdit || isLockedRequired}
                                  onCheckedChange={(checked) =>
                                    updateQuestion(question.id, (existing) => ({
                                      ...existing,
                                      required: Boolean(checked),
                                    }))
                                  }
                                />
                                {attemptedSubmit && fieldErrors?.required ? (
                                  <p className="text-xs text-destructive">{fieldErrors.required}</p>
                                ) : null}
                              </div>
                            </td>
                          ) : null}

                          {visibleColumns.helpText ? (
                            <td className="px-3 py-3">
                              <Textarea
                                value={question.helpText}
                                disabled={!canEdit}
                                placeholder="Add optional help text"
                                onChange={(event) =>
                                  updateQuestion(question.id, (existing) => ({
                                    ...existing,
                                    helpText: event.target.value,
                                  }))
                                }
                                className="min-h-[72px] border-2 border-primary/30 shadow-lg"
                              />
                            </td>
                          ) : null}

                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Duplicate question"
                                onClick={() => duplicateQuestion(question)}
                                disabled={!canEdit}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete question"
                                onClick={() => removeQuestion(question.id)}
                                disabled={!canEdit}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={Boolean(pendingConfirm)} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogDetails?.title ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialogDetails?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmProceed}>
              {confirmDialogDetails?.actionLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportConfirmOpen}
        onOpenChange={(open) => {
          setExportConfirmOpen(open);
          setExportStep(1);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {exportStep === 1 ? "Export range" : "Confirm export"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {exportStep === 1
                ? "Visible columns and every row matching your filters are queued for export. Review and continue to confirm."
                : "Ready to export? A CSV will download with those visible columns for all filtered rows."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                if (exportStep === 1) {
                  return;
                }
                event.preventDefault();
                setExportStep(1);
              }}
            >
              {exportStep === 1 ? "Cancel" : "Back"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                if (exportStep === 1) {
                  event.preventDefault();
                  setExportStep(2);
                  return;
                }
                onExport();
                setExportConfirmOpen(false);
              }}
            >
              {exportStep === 1 ? "Continue" : "Confirm export"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
