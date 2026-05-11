import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'

interface Props { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Foi convidado para a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>{siteName}</Text></Section>
        <Heading style={h1}>Foi convidado</Heading>
        <Text style={text}>Foi convidado a juntar-se à plataforma <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>. Clique abaixo para aceitar e definir a sua palavra-passe.</Text>
        <Button style={button} href={confirmationUrl}>Aceitar convite</Button>
        <Text style={footer}>Se não estava à espera deste convite, pode ignorar este email em segurança.</Text>
      </Container>
    </Body>
  </Html>
)
export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { borderBottom: '3px solid #E8B923', paddingBottom: '12px', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: '#1a1a1a', textDecoration: 'underline' }
const button = { backgroundColor: '#1a1a1a', color: '#E8B923', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
