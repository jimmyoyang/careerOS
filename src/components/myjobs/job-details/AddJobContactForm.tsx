"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ComboBox";
import AddContact from "@/components/AddContact";
import { toastActionResult } from "@/lib/toast";
import { addJobContact } from "@/actions/contact.actions";
import type { ContactRef, ContactRole } from "@/models/contact.model";
import type { Company, JobLocation } from "@/models/job.model";

const LinkContactSchema = z.object({
  contact: z.string().min(1, "请选择联系人。"),
  contactRole: z.string().min(1, "请选择角色。"),
});

type LinkContactValues = z.infer<typeof LinkContactSchema>;

type AddJobContactFormProps = {
  jobId: string;
  contacts: ContactRef[];
  roles: ContactRole[];
  companies: Company[];
  locations: JobLocation[];
  onCancel: () => void;
  onLinked: () => void;
  onContactCreated: (contact: ContactRef) => void;
};

export function AddJobContactForm({
  jobId,
  contacts,
  roles,
  companies,
  locations,
  onCancel,
  onLinked,
  onContactCreated,
}: AddJobContactFormProps) {
  const [isPending, startTransition] = useTransition();
  const [newContactOpen, setNewContactOpen] = useState(false);
  // What the contact picker's search box holds, so "New contact" can carry it
  const [typedName, setTypedName] = useState("");

  const form = useForm<LinkContactValues>({
    resolver: zodResolver(LinkContactSchema),
    defaultValues: { contact: "", contactRole: "" },
  });

  const onSubmit = (values: LinkContactValues) => {
    startTransition(async () => {
      const res = await addJobContact(jobId, values.contact, values.contactRole);
      toastActionResult(res, {
        success: "联系人已关联到该职位",
        onSuccess: () => {
          form.reset();
          onLinked();
        },
      });
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-wrap items-end gap-3"
      >
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>联系人</FormLabel>
              <Combobox
                options={contacts}
                field={field}
                label="联系人"
                onSearchChange={setTypedName}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactRole"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>角色</FormLabel>
              <Combobox options={roles} field={field} creatable label="角色" />
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="cursor-pointer" disabled={isPending}>
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={onCancel}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="link"
          className="cursor-pointer"
          onClick={() => setNewContactOpen(true)}
        >
          新建联系人
        </Button>
      </form>

      {/* A contact has a dozen fields, so the picker has no creatable path:
          the typed name carries into the full dialog instead. */}
      <AddContact
        hideTrigger
        prefillName={typedName}
        dialogOpen={newContactOpen}
        setDialogOpen={setNewContactOpen}
        companies={companies}
        locations={locations}
        roles={roles}
        reloadContacts={() => {}}
        resetEditContact={() => {}}
        onSaved={(contact) => {
          onContactCreated(contact);
          form.setValue("contact", contact.id);
        }}
      />
    </Form>
  );
}
