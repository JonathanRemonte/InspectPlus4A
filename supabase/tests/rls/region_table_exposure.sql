begin;

select plan(1);

select pass('EMB4A has no region tables to expose');

select * from finish();

rollback;
