"use client";
import { ResumeSection } from "@/models/profile.model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Edit, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface CertificationCardProps {
  certificationSection: ResumeSection | undefined;
  openDialogForEdit: (id: string) => void;
}

function CertificationCard({
  certificationSection,
  openDialogForEdit,
}: CertificationCardProps) {
  const { sectionTitle, licenseOrCertifications } = certificationSection!;
  return (
    <>
      <CardTitle className="pl-6 py-3">{sectionTitle}</CardTitle>
      {licenseOrCertifications?.map(
        ({
          id,
          title,
          organization,
          issueDate,
          expirationDate,
          credentialUrl,
        }) => (
          <Card key={id}>
            <CardHeader className="p-2 pb-0 flex-row justify-between relative">
              <CardTitle className="text-xl pl-4">{title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 absolute top-0 right-1"
                onClick={() => openDialogForEdit(id!)}
              >
                <Edit className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  编辑
                </span>
              </Button>
            </CardHeader>
            <CardContent>
              <h3>{organization}</h3>
              <CardDescription>
                {issueDate && (
                  <>颁发日期： {format(new Date(issueDate), "yyyy年M月")}</>
                )}
                {issueDate && expirationDate && " · "}
                {expirationDate ? (
                  <>到期日期： {format(new Date(expirationDate), "yyyy年M月")}</>
                ) : (
                  issueDate && " · 长期有效"
                )}
              </CardDescription>
              {credentialUrl && (
                <a
                  href={credentialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline mt-1"
                >
                  查看证书
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </CardContent>
          </Card>
        ),
      )}
    </>
  );
}

export default CertificationCard;
