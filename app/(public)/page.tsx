"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, Users, Heart, Zap, Shield, Award, Star } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { t } from "@/lib/i18n-client"

const TEMPLATES = [
  { id: "christmas", name: "Christmas", emoji: "🎄", image: "/christmas-family-photo-cozy-warm-lights.jpg" },
  { id: "birthday", name: "Birthday", emoji: "🎂", image: "/birthday-celebration-family-photo.jpg" },
  { id: "wedding", name: "Wedding", emoji: "💒", image: "/wedding-family-photo-elegant.jpg" },
  { id: "graduation", name: "Graduation", emoji: "🎓", image: "/graduation-family-photo-celebration.jpg" },
  { id: "reunion", name: "Family Reunion", emoji: "👨‍👩‍👧‍👦", image: "/family-reunion-outdoor-photo.jpg" },
]

const TESTIMONIALS = [
  {
    quote:
      "This helped us reconnect as a family. Seeing us all together in these beautiful scenes brought tears to my eyes.",
    author: "Sarah M.",
    avatar: "/diverse-woman-smiling.png",
  },
  {
    quote: "Our best Christmas card ever! Everyone asked how we got such a perfect family photo.",
    author: "Michael T.",
    avatar: "/smiling-man.png",
  },
  {
    quote: "The quality is incredible. It feels like we were really there together in that moment.",
    author: "Jennifer L.",
    avatar: "/woman-happy.jpg",
  },
]

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <motion.section
          className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 gradient-animate" />

          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl animate-pulse delay-300" />
            <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-pulse delay-700" />
          </div>

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-4xl mx-auto text-center space-y-8"
              variants={containerVariants}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4"
                variants={fadeUpVariants}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{t("hero.tagline")}</span>
              </motion.div>

              <motion.h1
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-balance"
                variants={fadeUpVariants}
              >
                {t("hero.title")}
              </motion.h1>

              <motion.p
                className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto text-pretty"
                variants={fadeUpVariants}
              >
                {t("hero.subtitle")}
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                variants={fadeUpVariants}
              >
                <Link href="/generate">
                  <Button size="lg" className="rounded-full text-lg px-8 h-14 shadow-lg hover:shadow-xl transition-all">
                    <Sparkles className="w-5 h-5 mr-2" />
                    {t("cta.generateNow")}
                  </Button>
                </Link>
                <Link href="/generate">
                  <Button size="lg" variant="outline" className="rounded-full text-lg px-8 h-14 glass bg-transparent">
                    {t("cta.getStarted")}
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* Feature Highlights */}
        <motion.section
          className="py-24 bg-muted/30"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-5xl mx-auto"
              variants={containerVariants}
            >
              <motion.div
                className="glass p-8 rounded-3xl space-y-4 text-center transition-all hover:scale-105 hover:shadow-xl"
                variants={fadeUpVariants}
              >
                <Users className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-xl font-semibold">Multiple Styles</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Choose from Realistic, Anime, Vintage & more artistic styles
                </p>
              </motion.div>
              <motion.div
                className="glass p-8 rounded-3xl space-y-4 text-center transition-all hover:scale-105 hover:shadow-xl"
                variants={fadeUpVariants}
              >
                <Zap className="w-12 h-12 text-accent mx-auto" />
                <h3 className="text-xl font-semibold">Fast Generation</h3>
                <p className="text-muted-foreground leading-relaxed">Get stunning results in under 60 seconds</p>
              </motion.div>
              <motion.div
                className="glass p-8 rounded-3xl space-y-4 text-center transition-all hover:scale-105 hover:shadow-xl"
                variants={fadeUpVariants}
              >
                <Heart className="w-12 h-12 text-primary mx-auto" />
                <h3 className="text-xl font-semibold">HD Quality</h3>
                <p className="text-muted-foreground leading-relaxed">Download premium high-resolution images</p>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* Why Choose Us */}
        <motion.section
          className="py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center space-y-4 mb-16"
              variants={fadeUpVariants}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-balance">
                Why{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Families Love Us
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                Creating meaningful memories with care and precision
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
              variants={containerVariants}
            >
              <motion.div variants={fadeUpVariants}>
                <Card className="p-8 glass text-center space-y-4 border-2 hover:border-primary/50 transition-all">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                    <Heart className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">Made with Care</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Every generation is crafted with attention to detail and emotional authenticity
                  </p>
                </Card>
              </motion.div>

              <motion.div variants={fadeUpVariants}>
                <Card className="p-8 glass text-center space-y-4 border-2 hover:border-primary/50 transition-all">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">Privacy First</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Your photos are secure and never shared. We respect your family's privacy
                  </p>
                </Card>
              </motion.div>

              <motion.div variants={fadeUpVariants}>
                <Card className="p-8 glass text-center space-y-4 border-2 hover:border-primary/50 transition-all">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                    <Award className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">Trusted Worldwide</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Join thousands of families creating beautiful memories together
                  </p>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* Templates Showcase */}
        <motion.section
          className="py-24 bg-muted/30"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center space-y-4 mb-16"
              variants={fadeUpVariants}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-balance">
                Templates for{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Every Moment
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                Choose from our curated collection of family photo templates
              </p>
            </motion.div>

            <div className="overflow-x-auto pb-8 -mx-4 px-4">
              <motion.div
                className="flex gap-6 min-w-max"
                variants={containerVariants}
              >
                {TEMPLATES.map((template, index) => (
                  <motion.div
                    key={template.id}
                    variants={fadeUpVariants}
                    custom={index}
                  >
                    <Card className="glass overflow-hidden group hover:shadow-2xl transition-all hover:scale-105 w-80 shrink-0">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={template.image || "/placeholder.svg"}
                          alt={template.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-6 text-center">
                        <div className="text-3xl mb-2">{template.emoji}</div>
                        <h3 className="text-xl font-semibold">{template.name}</h3>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Testimonials */}
        <motion.section
          className="py-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="text-center space-y-4 mb-16"
              variants={fadeUpVariants}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-balance">
                What{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Families Say
                </span>
              </h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
              variants={containerVariants}
            >
              {TESTIMONIALS.map((testimonial, idx) => (
                <motion.div key={idx} variants={fadeUpVariants}>
                  <Card className="p-8 glass space-y-6 hover:shadow-xl transition-all">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-muted-foreground leading-relaxed italic">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      <img
                        src={testimonial.avatar || "/placeholder.svg"}
                        alt={testimonial.author}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className="font-semibold">{testimonial.author}</div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        {/* Final CTA Banner */}
        <motion.section
          className="py-24 relative overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 gradient-animate" />
          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              className="max-w-3xl mx-auto text-center space-y-8 glass p-12 rounded-3xl"
              variants={fadeUpVariants}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-balance">
                Ready to Create Your{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Family Mosaic?
                </span>
              </h2>
              <p className="text-lg text-muted-foreground text-pretty">
                Join thousands of families preserving their precious moments
              </p>
              <Link href="/generate">
                <Button size="lg" className="rounded-full text-lg px-8 h-14 shadow-lg hover:shadow-xl transition-all">
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t("cta.generateNow")}
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  )
}

