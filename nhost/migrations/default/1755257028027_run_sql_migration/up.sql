CREATE TABLE public.org_size (value text PRIMARY KEY, comment text);
INSERT INTO public.org_size (value, comment) VALUES
('S2_10','2–10'), ('S11_50','11–50'), ('S51_200','51–200'),
('S201_500','201–500'), ('S501_1000','501–1,000'),
('S1001_5000','1,001–5,000'), ('S5001_10000','5,001–10,000'),
('S10001_PLUS','10,001+');
