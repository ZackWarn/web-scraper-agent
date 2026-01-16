import sqlite3

conn = sqlite3.connect('db.sqlite')
conn.row_factory = sqlite3.Row
c = conn.cursor()

domains = ['example.com', 'iana.org', 'python.org']

print('=== CONTACT INFORMATION ===')
for domain in domains:
    c.execute('SELECT domain, company_name, email, phone FROM contact_information WHERE domain = ?', (domain,))
    rows = c.fetchall()
    if rows:
        for row in rows:
            print(f"{domain}: {dict(row)}")

print('\n=== COMPANY INFORMATION ===')
c.execute('SELECT * FROM company_information WHERE domain IN (?, ?, ?)', domains)
for row in c.fetchall():
    print(dict(row))

print('\n=== DESCRIPTION & INDUSTRY ===')
c.execute('SELECT domain, industry, sic_code FROM description_industry WHERE domain IN (?, ?, ?)', domains)
for row in c.fetchall():
    print(dict(row))

print('\n=== SERVICES ===')
c.execute('SELECT domain, item_name FROM services WHERE domain IN (?, ?, ?)', domains)
for row in c.fetchall():
    print(dict(row))

print('\n=== CERTIFICATIONS ===')
c.execute('SELECT domain, certification FROM certifications WHERE domain IN (?, ?, ?)', domains)
for row in c.fetchall():
    print(dict(row))

conn.close()
