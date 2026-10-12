"use client";
import { zhLabel } from "@/lib/i18n/zh-CN";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { PlusCircle, Trash, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { toastActionResult } from "@/lib/toast";
import {
  getAllContacts,
  getJobContacts,
  removeJobContact,
} from "@/actions/contact.actions";
import { getAllContactRoles } from "@/actions/contactRole.actions";
import type {
  ContactRef,
  ContactRole,
  JobContactLink,
} from "@/models/contact.model";
import type { Company, JobLocation } from "@/models/job.model";
import { JobTabEmptyState } from "./JobTabEmptyState";
import { AddJobContactForm } from "./AddJobContactForm";

type JobContactsTabProps = {
  jobId: string;
  links: JobContactLink[];
  onLinksChange: (links: JobContactLink[]) => void;
  companies?: Company[];
  locations?: JobLocation[];
};

export function JobContactsTab({
  jobId,
  links,
  onLinksChange,
  companies = [],
  locations = [],
}: JobContactsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [contacts, setContacts] = useState<ContactRef[]>([]);
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [removeTarget, setRemoveTarget] = useState<JobContactLink | null>(null);
  const loadedRef = useRef(false);

  // The job page already runs seven parallel queries and most visits never
  // leave Description, so the pickers wait for the first open of the form.
  const openForm = async () => {
    setShowForm(true);
    if (loadedRef.current) return;
    loadedRef.current = true;
    const [contactList, roleList] = await Promise.all([
      getAllContacts(),
      getAllContactRoles(),
    ]);
    if (Array.isArray(contactList)) setContacts(contactList);
    if (Array.isArray(roleList)) setRoles(roleList);
  };

  const reload = async () => {
    const fresh = await getJobContacts(jobId);
    if (Array.isArray(fresh)) onLinksChange(fresh);
  };

  const onRemove = async () => {
    if (!removeTarget) return;
    const res = await removeJobContact(removeTarget.id);
    setRemoveTarget(null);
    toastActionResult(res, {
      success: "已解除联系人与该职位的关联",
      onSuccess: reload,
    });
  };

  return (
    <div className="space-y-4">
      {links.length > 0 && !showForm && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={openForm}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            添加联系人
          </Button>
        </div>
      )}

      {showForm && (
        <AddJobContactForm
          jobId={jobId}
          contacts={contacts}
          roles={roles}
          companies={companies}
          locations={locations}
          onCancel={() => setShowForm(false)}
          onLinked={() => {
            setShowForm(false);
            reload();
          }}
          onContactCreated={(contact) => setContacts([contact, ...contacts])}
        />
      )}

      {links.length === 0 && !showForm && (
        <JobTabEmptyState
          icon={Users}
          title="该职位暂无联系人"
          description="关联这次申请的招聘人员、面试官或推荐人。"
          actionLabel="添加联系人"
          onAction={openForm}
        />
      )}

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm"
            >
              <span className="font-medium">{row.Contact?.name}</span>
              {row.Contact?.title && (
                <span className="text-muted-foreground">
                  {row.Contact.title}
                </span>
              )}
              {row.Contact?.Company && (
                <span className="text-muted-foreground">
                  {row.Contact.Company.label}
                </span>
              )}
              <Badge variant="secondary">{zhLabel(row.Role.label)}</Badge>
              {row.Contact?.email && (
                <a
                  href={`mailto:${row.Contact.email}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {row.Contact.email}
                </a>
              )}
              {row.Contact?.phone && (
                <a
                  href={`tel:${row.Contact.phone}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {row.Contact.phone}
                </a>
              )}
              {row.Contact?.linkedinUrl && (
                <a
                  href={row.Contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  LinkedIn
                </a>
              )}
              {row.Contact?.lastContactedAt && (
                <span className="text-muted-foreground">
                  最近联系 {format(row.Contact.lastContactedAt, "yyyy年M月d日")}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto cursor-pointer"
                aria-label={`移除${row.Contact?.name}`}
                onClick={() => setRemoveTarget(row)}
              >
                <Trash className="h-4 w-4 text-red-600" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <DeleteAlertDialog
        pageTitle="联系人关联"
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onDelete={onRemove}
        alertDescription="此操作仅解除联系人与该职位的关联，联系人仍会保留。"
      />
    </div>
  );
}
