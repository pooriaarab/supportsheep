import "dotenv/config";

import { collections } from "@/lib/db/firebase-admin";

const snapshot = await collections
  .programmaticPages()
  .where("collection", "==", "for")
  .limit(10)
  .get();

console.info(
  JSON.stringify(
    {
      count: snapshot.size,
      docs: snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          collection: data.collection,
          variantKey: data.variantKey,
          publishStatus: data.publishStatus,
          wordCount: data.wordCount,
          title: data.title,
          metaDescription: data.metaDescription,
          variables: data.variables,
          faqCount: Array.isArray(data.faqs) ? data.faqs.length : 0,
          firstFaq: Array.isArray(data.faqs) ? data.faqs[0] : null,
          uniqueContentPreview: (data.uniqueContent ?? "").slice(0, 800),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }),
    },
    null,
    2,
  ),
);

process.exit(0);
