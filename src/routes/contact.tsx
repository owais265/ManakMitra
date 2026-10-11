import { createFileRoute } from '@tanstack/react-router';
import ContactPage from '@/components/contact-page';

export const Route = createFileRoute('/contact')({
  component: ContactRoute,
});

function ContactRoute() {
  return <ContactPage />;
}
