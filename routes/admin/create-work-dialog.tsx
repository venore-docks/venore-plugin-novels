"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  useActionToast,
} from "@venore/plugin-sdk/ui";
import { SUPPORTED_LOCALES } from "../../shared/locales";
import { slugify } from "../../shared/slug";
import { createWorkAction, type AdminActionState } from "./actions";

const initialState: AdminActionState = { error: null };

export function CreateWorkDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [state, formAction, pending] = useActionState(createWorkAction, initialState);
  useActionToast({ pending, error: state.error });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nova obra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova obra</DialogTitle>
          <DialogDescription>Depois de criar, você configura idiomas, capa, variáveis e capítulos.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Título</span>
            <Input
              name="title"
              required
              maxLength={160}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Endereço</span>
            <Input
              name="slug"
              required
              maxLength={80}
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
            />
            <span className="text-xs text-muted-foreground">/novels/{slug || "..."}</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Idioma principal</span>
            <select
              name="defaultLocale"
              defaultValue="pt-BR"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending} className="w-full">
            Criar obra
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
