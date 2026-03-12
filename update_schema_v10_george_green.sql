-- Insert George Green B.C

INSERT INTO churches (name, code)
VALUES ('George Green B.C', 'GGBC')
ON CONFLICT (code) DO NOTHING;
