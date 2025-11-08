"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { HelpCircle, MessageCircle, Mail } from "lucide-react"
import Link from "next/link"

const FAQS = [
  {
    question: "How does Family Mosaic Maker work?",
    answer:
      "Upload your portrait photos and our AI will transform them into beautiful family scenes. Simply choose your preferred style, and we'll generate 4 high-quality variations for you.",
  },
  {
    question: "What file formats are supported?",
    answer:
      "We support PNG, JPG, JPEG, and WebP formats. For best results, use high-resolution images with clear faces.",
  },
  {
    question: "How long does generation take?",
    answer:
      "Most generations complete within 30-60 seconds. You'll be redirected to the results page automatically when ready.",
  },
  {
    question: "Can I use the images commercially?",
    answer:
      "Yes! All generated images come with full commercial usage rights. You can use them for personal or business purposes.",
  },
  {
    question: "What's your refund policy?",
    answer:
      "If you're not satisfied with the results, contact us within 24 hours for a full refund. We want you to love your family mosaics!",
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-balance">
              How Can We{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Help You?</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Find answers to common questions about Family Mosaic Maker
            </p>
          </div>

          {/* FAQ Accordion */}
          <Card className="p-6 sm:p-8 glass mb-8">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {FAQS.map((faq, idx) => (
                <AccordionItem key={idx} value={`item-${idx}`} className="border-b border-border/50">
                  <AccordionTrigger className="text-left hover:text-primary transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>

          {/* Ask a Question CTA section */}
          <Card className="p-8 glass text-center space-y-6 mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Still Have Questions?</h3>
              <p className="text-muted-foreground mb-6">
                Our support team is here to help you create the perfect family memories
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="rounded-full" size="lg">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" className="rounded-full glass bg-transparent" size="lg">
                Live Chat
              </Button>
            </div>
          </Card>

          {/* Policy Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors underline">
              Privacy Policy
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors underline">
              Terms of Service
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors underline">
              Refund Policy
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
