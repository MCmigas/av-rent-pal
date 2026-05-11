import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>O seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}><Text style={brand}>GESTio</Text></Section>
        <Heading style={h1}>Código de verificação</Heading>
        <Text style={text}>Use o código abaixo para confirmar a sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>Este código expira em breve. Se não pediu esta verificação, ignore este email.</Text>
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px' }
const brandBar = { borderBottom: '3px solid #E8B923', paddingBottom: '12px', marginBottom: '24px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#1a1a1a', letterSpacing: '0.3em', margin: '0 0 24px', padding: '14px 18px', backgroundColor: '#fff8dc', borderRadius: '8px', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
