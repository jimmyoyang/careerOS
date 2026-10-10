import { AddContactInfoFormSchema } from "@/models/addContactInfoForm.schema";

const valid = {
  resumeId: "resume-1",
  firstName: "Ada",
  lastName: "Lovelace",
  headline: "Software Engineer",
  email: "ada@example.com",
  phone: "555-0100",
};

const errorFor = (data: unknown, path: string) => {
  const result = AddContactInfoFormSchema.safeParse(data);
  return result.success
    ? undefined
    : result.error.issues.find((i) => i.path[0] === path)?.message;
};

describe("AddContactInfoFormSchema", () => {
  describe("valid data", () => {
    it("accepts the required fields on their own", () => {
      const result = AddContactInfoFormSchema.parse(valid);
      expect(result.firstName).toBe("Ada");
      expect(result.email).toBe("ada@example.com");
    });

    it("accepts both optional links with labels", () => {
      const result = AddContactInfoFormSchema.parse({
        ...valid,
        address: "London",
        url1: "https://linkedin.com/in/ada",
        url1Label: "LinkedIn",
        url2: "http://github.com/ada",
        url2Label: "GitHub",
      });
      expect(result.url1).toBe("https://linkedin.com/in/ada");
      expect(result.url2).toBe("http://github.com/ada");
    });

    it("treats links, labels and address as optional", () => {
      const result = AddContactInfoFormSchema.parse(valid);
      expect(result.address).toBeUndefined();
      expect(result.url1).toBeUndefined();
      expect(result.url2Label).toBeUndefined();
    });

    it("accepts empty strings for the links, which the actions store as null", () => {
      const result = AddContactInfoFormSchema.safeParse({
        ...valid,
        url1: "",
        url1Label: "",
        url2: "",
        url2Label: "",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("name and headline", () => {
    it("accepts single-character Chinese names", () => {
      expect(AddContactInfoFormSchema.parse({ ...valid, firstName: "伟", lastName: "张" })).toMatchObject({ firstName: "伟", lastName: "张" });
    });
    it("rejects an empty first name", () => {
      expect(errorFor({ ...valid, firstName: "" }, "firstName")).toBe(
        "请填写名。",
      );
    });

    it("rejects a blank last name", () => {
      expect(errorFor({ ...valid, lastName: "  " }, "lastName")).toBe(
        "请填写姓。",
      );
    });

    it("rejects a headline shorter than 2 characters", () => {
      expect(errorFor({ ...valid, headline: "E" }, "headline")).toBe(
        "职业简介至少需要 2 个字符。",
      );
    });

    it("rejects a missing first name", () => {
      const { firstName, ...withoutFirstName } = valid;
      expect(
        AddContactInfoFormSchema.safeParse(withoutFirstName).success,
      ).toBe(false);
    });
  });

  describe("email", () => {
    it("rejects a malformed address", () => {
      expect(errorFor({ ...valid, email: "not-an-email" }, "email")).toBe(
        "请输入有效的邮箱地址。",
      );
    });

    it("rejects a missing address", () => {
      const { email, ...withoutEmail } = valid;
      expect(AddContactInfoFormSchema.safeParse(withoutEmail).success).toBe(
        false,
      );
    });
  });

  describe("phone", () => {
    it("rejects a missing phone", () => {
      const { phone, ...withoutPhone } = valid;
      expect(AddContactInfoFormSchema.safeParse(withoutPhone).success).toBe(
        false,
      );
    });

    it("accepts any non-empty format, since numbers vary by country", () => {
      expect(
        AddContactInfoFormSchema.safeParse({ ...valid, phone: "+44 20 7946" })
          .success,
      ).toBe(true);
    });
  });

  describe("link URLs", () => {
    it("rejects a first link without a scheme", () => {
      expect(errorFor({ ...valid, url1: "linkedin.com/in/ada" }, "url1")).toBe(
        "链接必须以 http:// 或 https:// 开头。",
      );
    });

    it("rejects a second link without a scheme", () => {
      expect(errorFor({ ...valid, url2: "github.com/ada" }, "url2")).toBe(
        "链接必须以 http:// 或 https:// 开头。",
      );
    });

    it("accepts either scheme, case-insensitively", () => {
      expect(
        AddContactInfoFormSchema.safeParse({
          ...valid,
          url1: "HTTPS://example.com",
          url2: "Http://example.com",
        }).success,
      ).toBe(true);
    });
  });
});
