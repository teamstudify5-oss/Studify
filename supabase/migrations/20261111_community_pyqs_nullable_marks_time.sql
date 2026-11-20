-- ============================================================
-- STUDIFY MIGRATION 2
-- Optional marks and exam duration
-- Execution Order: Run 2nd in Supabase SQL Editor
-- ============================================================

-- 1. Verify the expected columns and their types.

DO $$
DECLARE
    marks_type text;
    duration_type text;
BEGIN
    SELECT data_type
    INTO marks_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_pyqs'
      AND column_name = 'total_marks';

    SELECT data_type
    INTO duration_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_pyqs'
      AND column_name = 'time_allowed_minutes';

    IF marks_type IS NULL OR duration_type IS NULL THEN
        RAISE EXCEPTION
            'Required community_pyqs columns are missing.';
    END IF;

    IF marks_type NOT IN ('smallint', 'integer', 'bigint')
       OR duration_type NOT IN ('smallint', 'integer', 'bigint') THEN

        RAISE EXCEPTION
            'Unexpected column types: total_marks=%, time_allowed_minutes=%. Review integer validation before continuing.',
            marks_type,
            duration_type;
    END IF;
END $$;

-- 2. Make the two fields optional.

ALTER TABLE public.community_pyqs
    ALTER COLUMN total_marks DROP NOT NULL,
    ALTER COLUMN total_marks DROP DEFAULT,
    ALTER COLUMN time_allowed_minutes DROP NOT NULL,
    ALTER COLUMN time_allowed_minutes DROP DEFAULT;

-- 3. Remove only pure single-column NOT NULL CHECK constraints.
-- Preserve all combined and unrelated validation constraints.

DO $$
DECLARE
    con record;
    normalized_def text;
BEGIN
    FOR con IN
        SELECT
            c.conname,
            a.attname AS column_name,
            pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t
            ON t.oid = c.conrelid
        JOIN pg_namespace n
            ON n.oid = t.relnamespace
        JOIN pg_attribute a
            ON a.attrelid = t.oid
           AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'community_pyqs'
          AND c.contype = 'c'
          AND array_length(c.conkey, 1) = 1
          AND a.attname IN (
              'total_marks',
              'time_allowed_minutes'
          )
          AND c.conname NOT IN (
              'community_pyqs_total_marks_positive_check',
              'community_pyqs_time_allowed_minutes_positive_check'
          )
    LOOP
        normalized_def :=
            regexp_replace(
                lower(con.definition),
                '[[:space:]()]',
                '',
                'g'
            );

        IF normalized_def =
            'check' || con.column_name || 'isnotnull' THEN

            EXECUTE format(
                'ALTER TABLE public.community_pyqs DROP CONSTRAINT %I',
                con.conname
            );

            RAISE NOTICE
                'Removed pure NOT NULL CHECK constraint: %',
                con.conname;
        END IF;
    END LOOP;
END $$;

-- 4. Stop if another remaining CHECK constraint explicitly
-- requires either optional field to be NOT NULL.
-- Such constraints must be reviewed and rewritten while
-- preserving their other business rules.

DO $$
DECLARE
    con record;
BEGIN
    FOR con IN
        SELECT DISTINCT
            c.conname,
            pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a
            ON a.attrelid = t.oid
           AND a.attnum = ANY(c.conkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'community_pyqs'
          AND c.contype = 'c'
          AND a.attname IN (
              'total_marks',
              'time_allowed_minutes'
          )
          AND pg_get_constraintdef(c.oid) ~* 'IS[[:space:]]+NOT[[:space:]]+NULL'
    LOOP
        RAISE EXCEPTION
            'Constraint "%" still contains an IS NOT NULL condition: %. Review and preserve its other rules before allowing NULL.',
            con.conname,
            con.definition;
    END LOOP;
END $$;

-- 5. Create the positive-value CHECK constraints safely.
-- NULL is allowed; zero and negative values are rejected.
-- Never delete an unexpected existing constraint.
-- Accepts both validated and NOT VALID forms of the expected definition so re-runs stay idempotent even if legacy invalid rows exist.

DO $$
DECLARE
    marks_def text;
    duration_def text;
    normalized_marks_def text;
    normalized_duration_def text;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
    INTO marks_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'community_pyqs'
      AND c.conname = 'community_pyqs_total_marks_positive_check';

    IF marks_def IS NULL THEN
        ALTER TABLE public.community_pyqs
            ADD CONSTRAINT community_pyqs_total_marks_positive_check
            CHECK (
                total_marks IS NULL OR total_marks > 0
            ) NOT VALID;
    ELSE
        normalized_marks_def :=
            regexp_replace(
                lower(marks_def),
                '[[:space:]()]',
                '',
                'g'
            );

        IF normalized_marks_def NOT IN (
            'checktotal_marksisnullortotal_marks>0',
            'checktotal_marksisnullortotal_marks>0notvalid'
        ) THEN
            RAISE EXCEPTION
                'Existing total_marks positive constraint has an unexpected definition: %',
                marks_def;
        END IF;
    END IF;

    SELECT pg_get_constraintdef(c.oid)
    INTO duration_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'community_pyqs'
      AND c.conname = 'community_pyqs_time_allowed_minutes_positive_check';

    IF duration_def IS NULL THEN
        ALTER TABLE public.community_pyqs
            ADD CONSTRAINT community_pyqs_time_allowed_minutes_positive_check
            CHECK (
                time_allowed_minutes IS NULL OR time_allowed_minutes > 0
            ) NOT VALID;
    ELSE
        normalized_duration_def :=
            regexp_replace(
                lower(duration_def),
                '[[:space:]()]',
                '',
                'g'
            );

        IF normalized_duration_def NOT IN (
            'checktime_allowed_minutesisnullortime_allowed_minutes>0',
            'checktime_allowed_minutesisnullortime_allowed_minutes>0notvalid'
        ) THEN
            RAISE EXCEPTION
                'Existing time_allowed_minutes positive constraint has an unexpected definition: %',
                duration_def;
        END IF;
    END IF;
END $$;

-- 6. Validate both new positive-value constraints.
-- If existing legacy records violate a constraint, preserve those records,
-- report their count, and leave that constraint NOT VALID.

DO $$
DECLARE
    is_valid boolean;
    invalid_count bigint;
BEGIN
    SELECT convalidated
    INTO is_valid
    FROM pg_constraint
    WHERE conrelid = 'public.community_pyqs'::regclass
      AND conname = 'community_pyqs_total_marks_positive_check';

    IF COALESCE(is_valid, false) = false THEN
        BEGIN
            ALTER TABLE public.community_pyqs
                VALIDATE CONSTRAINT
                community_pyqs_total_marks_positive_check;
        EXCEPTION WHEN check_violation THEN
            SELECT count(*)
            INTO invalid_count
            FROM public.community_pyqs
            WHERE total_marks IS NOT NULL
              AND total_marks <= 0;

            RAISE WARNING
                'Preserved % legacy rows with invalid total_marks.',
                invalid_count;
        END;
    END IF;

    SELECT convalidated
    INTO is_valid
    FROM pg_constraint
    WHERE conrelid = 'public.community_pyqs'::regclass
      AND conname = 'community_pyqs_time_allowed_minutes_positive_check';

    IF COALESCE(is_valid, false) = false THEN
        BEGIN
            ALTER TABLE public.community_pyqs
                VALIDATE CONSTRAINT
                community_pyqs_time_allowed_minutes_positive_check;
        EXCEPTION WHEN check_violation THEN
            SELECT count(*)
            INTO invalid_count
            FROM public.community_pyqs
            WHERE time_allowed_minutes IS NOT NULL
              AND time_allowed_minutes <= 0;

            RAISE WARNING
                'Preserved % legacy rows with invalid time_allowed_minutes.',
                invalid_count;
        END;
    END IF;
END $$;

COMMENT ON COLUMN public.community_pyqs.total_marks IS
    'Optional positive integer. NULL when unspecified by uploader.';

COMMENT ON COLUMN public.community_pyqs.time_allowed_minutes IS
    'Optional positive integer duration in minutes. NULL when unspecified by uploader.';
