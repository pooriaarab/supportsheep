import type { Metadata } from "next";
import { ContactPageContent } from "@/components/contact/contact-page-content";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact the Supportsheep team for support, questions, and feature requests.",
};

export default function ContactPage() {
  return <ContactPageContent />;
}
