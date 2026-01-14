import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).resolve().parent / "db.sqlite"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize all tables matching the Excel template structure."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS raw_scrapes (
                domain TEXT PRIMARY KEY,
                snapshot_path TEXT,
                clean_text TEXT,
                tech_stack TEXT,
                status TEXT DEFAULT 'READY',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Contact Information Table
            CREATE TABLE IF NOT EXISTS contact_information (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                text TEXT,
                company_name TEXT,
                full_address TEXT,
                phone TEXT,
                sales_phone TEXT,
                fax TEXT,
                mobile TEXT,
                other_numbers TEXT,
                email TEXT,
                hours_of_operation TEXT,
                hq_indicator TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Company Information Table
            CREATE TABLE IF NOT EXISTS company_information (
                domain TEXT PRIMARY KEY,
                company_name TEXT,
                acronym TEXT,
                logo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Social Media Table
            CREATE TABLE IF NOT EXISTS social_media (
                domain TEXT PRIMARY KEY,
                linkedin TEXT,
                facebook TEXT,
                x TEXT,
                instagram TEXT,
                youtube TEXT,
                blog TEXT,
                articles TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- People Information Table
            CREATE TABLE IF NOT EXISTS people_information (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                people_name TEXT,
                people_title TEXT,
                people_email TEXT,
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Description & Industry Table
            CREATE TABLE IF NOT EXISTS description_industry (
                domain TEXT PRIMARY KEY,
                long_description TEXT,
                short_description TEXT,
                sic_code TEXT,
                sic_text TEXT,
                sub_industry TEXT,
                industry TEXT,
                sector TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Certifications Table
            CREATE TABLE IF NOT EXISTS certifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                certification TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Services/Products Table
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                item_name TEXT,
                item_type TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Metrics Table (for performance tracking)
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                duration_seconds REAL,
                success BOOLEAN,
                error_msg TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


def upsert_raw_scrape(
    domain: str,
    snapshot_path: str,
    clean_text: str,
    tech_stack_json: str,
    status: str = "READY",
) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO raw_scrapes(domain, snapshot_path, clean_text, tech_stack, status)
            VALUES(?,?,?,?,?)
            ON CONFLICT(domain) DO UPDATE SET
                snapshot_path=excluded.snapshot_path,
                clean_text=excluded.clean_text,
                tech_stack=excluded.tech_stack,
                status=excluded.status,
                updated_at=CURRENT_TIMESTAMP;
            """,
            (domain, snapshot_path, clean_text, tech_stack_json, status),
        )


def fetch_pending_raw(limit: int = 10) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            """
            SELECT domain, clean_text, tech_stack
            FROM raw_scrapes WHERE status='READY'
            ORDER BY created_at LIMIT ?;
            """,
            (limit,),
        ).fetchall()


def update_raw_status(domain: str, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE raw_scrapes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE domain=?;
            """,
            (status, domain),
        )


def claim_pending_raw(worker_id: str, limit: int = 1) -> list[sqlite3.Row]:
    """Atomically claim pending domains for processing by a specific worker."""
    conn = get_conn()
    try:
        # Start transaction
        conn.execute("BEGIN IMMEDIATE")

        # Find READY domains
        cur = conn.execute(
            """
            SELECT domain, clean_text, tech_stack 
            FROM raw_scrapes 
            WHERE status='READY' 
            LIMIT ?
            """,
            (limit,),
        )
        rows = cur.fetchall()

        # Mark as PROCESSING
        for row in rows:
            conn.execute(
                """
                UPDATE raw_scrapes 
                SET status='PROCESSING', updated_at=CURRENT_TIMESTAMP 
                WHERE domain=? AND status='READY'
                """,
                (row["domain"],),
            )

        conn.commit()
        return rows
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def insert_contact_information(domain: str, data: dict) -> None:
    """Insert into contact_information table."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO contact_information (
                domain, text, company_name, full_address, phone, sales_phone, 
                fax, mobile, other_numbers, email, hours_of_operation, hq_indicator
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                domain,
                data.get("text", ""),
                data.get("company_name", ""),
                data.get("full_address", ""),
                data.get("phone", ""),
                data.get("sales_phone", ""),
                data.get("fax", ""),
                data.get("mobile", ""),
                data.get("other_numbers", ""),
                data.get("email", ""),
                data.get("hours_of_operation", ""),
                data.get("hq_indicator", ""),
            ),
        )


def insert_company_information(domain: str, data: dict) -> None:
    """Insert into company_information table."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO company_information (domain, company_name, acronym, logo_url)
            VALUES (?, ?, ?, ?)
            """,
            (
                domain,
                data.get("company_name", ""),
                data.get("acronym", ""),
                data.get("logo_url", ""),
            ),
        )


def insert_social_media(domain: str, data: dict) -> None:
    """Insert into social_media table."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO social_media (
                domain, linkedin, facebook, x, instagram, youtube, blog, articles
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                domain,
                data.get("linkedin", ""),
                data.get("facebook", ""),
                data.get("x", ""),
                data.get("instagram", ""),
                data.get("youtube", ""),
                data.get("blog", ""),
                data.get("articles", ""),
            ),
        )


def insert_people(domain: str, people_list: list) -> None:
    """Insert into people_information table."""
    with get_conn() as conn:
        for person in people_list:
            if isinstance(person, dict):
                conn.execute(
                    """
                    INSERT INTO people_information (domain, people_name, people_title, people_email, url)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        domain,
                        person.get("name", ""),
                        person.get("title", ""),
                        person.get("email", ""),
                        person.get("url", ""),
                    ),
                )


def insert_description_industry(domain: str, data: dict) -> None:
    """Insert into description_industry table."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO description_industry (
                domain, long_description, short_description, sic_code, sic_text, 
                sub_industry, industry, sector
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                domain,
                data.get("long_description", ""),
                data.get("short_description", ""),
                data.get("sic_code", ""),
                data.get("sic_text", ""),
                data.get("sub_industry", ""),
                data.get("industry", ""),
                data.get("sector", ""),
            ),
        )


def insert_certifications(domain: str, certs_list: list) -> None:
    """Insert into certifications table."""
    with get_conn() as conn:
        for cert in certs_list:
            if cert:
                conn.execute(
                    """
                    INSERT INTO certifications (domain, certification)
                    VALUES (?, ?)
                    """,
                    (domain, str(cert)),
                )


def insert_services(domain: str, items_list: list, item_type: str) -> None:
    """Insert into services table."""
    with get_conn() as conn:
        for item in items_list:
            if item:
                conn.execute(
                    """
                    INSERT INTO services (domain, item_name, item_type)
                    VALUES (?, ?, ?)
                    """,
                    (domain, str(item), item_type),
                )


def insert_metric(
    domain: str,
    start_time: str,
    end_time: str,
    duration: float,
    success: bool,
    error_msg: Optional[str] = None,
) -> None:
    """Insert performance metric."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO metrics (domain, start_time, end_time, duration_seconds, success, error_msg)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (domain, start_time, end_time, duration, success, error_msg),
        )


if __name__ == "__main__":
    init_db()
    print("Database initialized with all tables")
