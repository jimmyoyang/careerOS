"use client";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import ContactRow from "./ContactRow";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { deleteContactById } from "@/actions/contact.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { AlertDialog } from "@/models/alertDialog.model";
import type { Contact } from "@/models/contact.model";

type ContactsTableProps = {
  contacts: Contact[];
  reloadContacts: () => void;
  editContact: (id: string) => void;
  hideCompanyColumn?: boolean;
};

function ContactsTable({
  contacts,
  reloadContacts,
  editContact,
  hideCompanyColumn,
}: ContactsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  // A link is meaningless without the person and JobContact cascades from
  // contactId, so the dialog warns about the links rather than blocking.
  const onDeleteContact = (contact: Contact) => {
    const jobs = contact._count?.jobLinks ?? 0;
    setAlert({
      openState: true,
      deleteAction: true,
      itemId: contact.id,
      title: jobs > 0 ? "删除这个联系人？" : undefined,
      description:
        jobs > 0
          ? `${contact.name}关联了 ${jobs} 个职位。删除联系人将移除这些关联，此操作无法撤销。`
          : undefined,
    });
  };

  const deleteContact = async (contactId: string | undefined) => {
    if (contactId) {
      const { success, message } = await deleteContactById(contactId);
      if (success) {
        toastSuccess("联系人已删除");
        reloadContacts();
      } else {
        toastError(message);
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">展开</span>
            </TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="hidden sm:table-cell">标题</TableHead>
            {!hideCompanyColumn && <TableHead>公司</TableHead>}
            <TableHead>角色</TableHead>
            <TableHead>职位</TableHead>
            <TableHead>最近联系</TableHead>
            <TableHead>
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact: Contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              expanded={expandedId === contact.id}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === contact.id ? null : contact.id,
                )
              }
              onEdit={() => editContact(contact.id)}
              onDelete={() => onDeleteContact(contact)}
              hideCompanyColumn={hideCompanyColumn}
            />
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="联系人"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteContact(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ContactsTable;
