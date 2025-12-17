"use client";

import {
  PlusCircle,
  User,
  ClipboardList,
  Car,
  Truck,
  Dog,
  Trash2,
  Edit,
  Blocks,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { toast } from "@/hooks/use-toast";
import { useCondominio } from "@/contexts/CondominioContext";

const funcionarioSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    cargo: z.string().min(1, "Cargo é obrigatório"),
    horario: z.string().min(1, "Horário é obrigatório"),
    contato: z.string().min(1, "Contato é obrigatório"),
});

const veiculoSchema = z.object({
    placa: z.string().min(1, "Placa é obrigatória"),
    modelo: z.string().min(1, "Modelo é obrigatório"),
    unidade: z.string().min(1, "Unidade é obrigatória"),
});

const fornecedorSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    servico: z.string().min(1, "Serviço é obrigatório"),
    contato: z.string().min(1, "Contato é obrigatório"),
});

const petSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    raca: z.string().min(1, "Raça é obrigatória"),
    porte: z.string().min(1, "Porte é obrigatório"),
    unidade: z.string().min(1, "Unidade é obrigatória"),
});

const blocoSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    unidades: z.preprocess((a) => parseInt(z.string().parse(a), 10),
    z.number().positive("Deve ser um número positivo")),
});


const funcionarios = [
    { id: 1, nome: "José Almeida", cargo: "Zelador", horario: "08:00 - 17:00", contato: "(11) 98888-7777" },
    { id: 2, nome: "Ana Costa", cargo: "Porteiro", horario: "07:00 - 15:00 (Diurno)", contato: "(11) 97777-6666" },
];

const veiculos = [
    { id: 1, placa: "ABC-1234", modelo: "Honda Civic", unidade: "Apto 101" },
    { id: 2, placa: "XYZ-5678", modelo: "Toyota Corolla", unidade: "Apto 203" },
];

const fornecedores = [
    { id: 1, nome: "Jardim & Cia", servico: "Jardinagem", contato: "contato@jardimcia.com" },
    { id: 2, nome: "Limpa Mais", servico: "Limpeza Geral", contato: "(11) 5555-4444" },
];

const pets = [
    { id: 1, nome: "Rex", raca: "Labrador", porte: "Grande", unidade: "Apto 101" },
    { id: 2, nome: "Mimi", raca: "Siamês", porte: "Pequeno", unidade: "Apto 203" },
];

const blocos = [
    { id: 1, nome: "Bloco A", unidades: 40 },
    { id: 2, nome: "Bloco B", unidades: 40 },
];

const moradorSchema = z.object({
  nome: z.string().min(1, { message: "O nome é obrigatório" }),
  email: z.string().email({ message: "E-mail inválido" }),
  isResponsavel: z.boolean().default(false),
});


type MoradorFormData = z.infer<typeof moradorSchema>;
type FuncionarioFormData = z.infer<typeof funcionarioSchema>;
type VeiculoFormData = z.infer<typeof veiculoSchema>;
type FornecedorFormData = z.infer<typeof fornecedorSchema>;
type PetFormData = z.infer<typeof petSchema>;
type BlocoFormData = z.infer<typeof blocoSchema>;


export default function CadastrosPage() {
    const firestore = useFirestore();
    const { condominioAtivoId, blocoAtivoId, unidadeAtivaId } = useCondominio();

    const moradoresRef = useMemoFirebase(() => {
        if (!firestore || !condominioAtivoId || !blocoAtivoId || !unidadeAtivaId) return null;
        return collection(firestore, `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}/moradores`);
    }, [firestore, condominioAtivoId, blocoAtivoId, unidadeAtivaId]);

    const { data: moradores, isLoading } = useCollection(moradoresRef);
    
    const [openMorador, setOpenMorador] = React.useState(false);
    const [openFuncionario, setOpenFuncionario] = React.useState(false);
    const [openVeiculo, setOpenVeiculo] = React.useState(false);
    const [openFornecedor, setOpenFornecedor] = React.useState(false);
    const [openPet, setOpenPet] = React.useState(false);
    const [openBloco, setOpenBloco] = React.useState(false);


    const { register: registerMorador, handleSubmit: handleSubmitMorador, formState: { errors: errorsMorador }, reset: resetMorador } = useForm<MoradorFormData>({
        resolver: zodResolver(moradorSchema),
    });
    

    const { register: registerFuncionario, handleSubmit: handleSubmitFuncionario, formState: { errors: errorsFuncionario }, reset: resetFuncionario } = useForm<FuncionarioFormData>({ resolver: zodResolver(funcionarioSchema) });
    const { register: registerVeiculo, handleSubmit: handleSubmitVeiculo, formState: { errors: errorsVeiculo }, reset: resetVeiculo } = useForm<VeiculoFormData>({ resolver: zodResolver(veiculoSchema) });
    const { register: registerFornecedor, handleSubmit: handleSubmitFornecedor, formState: { errors: errorsFornecedor }, reset: resetFornecedor } = useForm<FornecedorFormData>({ resolver: zodResolver(fornecedorSchema) });
    const { register: registerPet, handleSubmit: handleSubmitPet, formState: { errors: errorsPet }, reset: resetPet } = useForm<PetFormData>({ resolver: zodResolver(petSchema) });
    const { register: registerBloco, handleSubmit: handleSubmitBloco, formState: { errors: errorsBloco }, reset: resetBloco } = useForm<BlocoFormData>({ resolver: zodResolver(blocoSchema) });


    const onMoradorSubmit = async (data: MoradorFormData) => {
        if (!moradoresRef) {
            toast({ title: "Erro", description: "Selecione um condomínio, bloco e unidade para continuar.", variant: "destructive" });
            return;
        }
        try {
            await addDoc(moradoresRef, { 
                ...data, 
                role: 'MORADOR',
                status: 'ATIVO',
                createdAt: new Date(),
             });
            toast({ title: "Sucesso!", description: "Novo morador adicionado." });
            setOpenMorador(false);
            resetMorador();
        } catch (error) {
            console.error("Erro ao adicionar morador: ", error);
            toast({ title: "Erro ao adicionar morador", description: "Tente novamente.", variant: "destructive" });
        }
    };
    
    const onFuncionarioSubmit = (data: FuncionarioFormData) => { console.log(data); setOpenFuncionario(false); resetFuncionario(); };
    const onVeiculoSubmit = (data: VeiculoFormData) => { console.log(data); setOpenVeiculo(false); resetVeiculo(); };
    const onFornecedorSubmit = (data: FornecedorFormData) => { console.log(data); setOpenFornecedor(false); resetFornecedor(); };
    const onPetSubmit = (data: PetFormData) => { console.log(data); setOpenPet(false); resetPet(); };
    const onBlocoSubmit = (data: BlocoFormData) => { console.log(data); setOpenBloco(false); resetBloco(); };

  return (
    <AppLayout pageTitle="Gestão de Cadastro">
        <Tabs defaultValue="moradores">
        <TabsList className="mb-4">
            <TabsTrigger value="moradores"><User className="mr-2"/>Moradores</TabsTrigger>
            <TabsTrigger value="funcionarios"><ClipboardList className="mr-2"/>Funcionários</TabsTrigger>
            <TabsTrigger value="veiculos"><Car className="mr-2"/>Veículos</TabsTrigger>
            <TabsTrigger value="fornecedores"><Truck className="mr-2"/>Fornecedores</TabsTrigger>
            <TabsTrigger value="pets"><Dog className="mr-2"/>Pets</TabsTrigger>
            <TabsTrigger value="blocos"><Blocks className="mr-2"/>Blocos e Unidades</TabsTrigger>
        </TabsList>
        
        {/* Tab de Moradores */}
        <TabsContent value="moradores">
            <div className="flex justify-end mb-4">
            <Dialog open={openMorador} onOpenChange={setOpenMorador}>
                <DialogTrigger asChild>
                    <Button disabled={!unidadeAtivaId}><PlusCircle className="mr-2" />Adicionar Morador</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Morador</DialogTitle>
                        <DialogDescription>Insira os dados do novo morador.</DialogDescription>
                    </DialogHeader>
                        <form onSubmit={handleSubmitMorador(onMoradorSubmit)}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1">
                                <Label htmlFor="nome-morador">Nome</Label>
                                <Input id="nome-morador" placeholder="Nome completo" {...registerMorador("nome")} />
                                {errorsMorador.nome && <p className="text-xs text-destructive">{errorsMorador.nome.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="email-morador">E-mail</Label>
                                <Input id="email-morador" placeholder="email@provedor.com" {...registerMorador("email")} />
                                {errorsMorador.email && <p className="text-xs text-destructive">{errorsMorador.email.message}</p>}
                            </div>
                            
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox id="responsavel-check" {...registerMorador("isResponsavel")} />
                                <label htmlFor="responsavel-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    É o responsável pela unidade?
                                </label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center">Carregando...</TableCell></TableRow>
                ) : !unidadeAtivaId ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Selecione um condomínio, bloco e unidade para ver os moradores.</TableCell></TableRow>
                ) : moradores?.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum morador cadastrado nesta unidade.</TableCell></TableRow>
                ) : (
                    moradores?.map(m => (
                        <TableRow key={m.id}>
                            <TableCell>{m.nome}</TableCell>
                            <TableCell>{m.email}</TableCell>
                            <TableCell>{m.isResponsavel ? "Sim" : "Não"}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </TabsContent>

        {/* Tab de Funcionários */}
            <TabsContent value="funcionarios">
            <div className="flex justify-end mb-4">
                <Dialog open={openFuncionario} onOpenChange={setOpenFuncionario}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2" />Adicionar Funcionário</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Funcionário</DialogTitle>
                        <DialogDescription>Insira os dados do novo funcionário.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitFuncionario(onFuncionarioSubmit)}>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-funcionario" className="text-right">Nome</Label>
                                <Input id="nome-funcionario" placeholder="Nome completo" className="col-span-3" {...registerFuncionario("nome")} />
                            </div>
                            {errorsFuncionario.nome && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFuncionario.nome.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="cargo-funcionario" className="text-right">Cargo</Label>
                                <Input id="cargo-funcionario" placeholder="Ex: Zelador" className="col-span-3" {...registerFuncionario("cargo")} />
                            </div>
                            {errorsFuncionario.cargo && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFuncionario.cargo.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="horario-funcionario" className="text-right">Horário</Label>
                                <Input id="horario-funcionario" placeholder="Ex: 08:00 - 17:00" className="col-span-3" {...registerFuncionario("horario")} />
                            </div>
                            {errorsFuncionario.horario && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFuncionario.horario.message}</p>}
                                <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contato-funcionario" className="text-right">Contato</Label>
                                <Input id="contato-funcionario" placeholder="(99) 99999-9999" className="col-span-3" {...registerFuncionario("contato")} />
                            </div>
                            {errorsFuncionario.contato && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFuncionario.contato.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                    {funcionarios.map(f => (
                    <TableRow key={f.id}>
                        <TableCell>{f.nome}</TableCell>
                        <TableCell>{f.cargo}</TableCell>
                        <TableCell>{f.horario}</TableCell>
                            <TableCell>{f.contato}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </TabsContent>

        {/* Tab de Veículos */}
            <TabsContent value="veiculos">
            <div className="flex justify-end mb-4">
            <Dialog open={openVeiculo} onOpenChange={setOpenVeiculo}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2" />Adicionar Veículo</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Veículo</DialogTitle>
                        <DialogDescription>Insira os dados do novo veículo.</DialogDescription>
                    </DialogHeader>
                        <form onSubmit={handleSubmitVeiculo(onVeiculoSubmit)}>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="placa-veiculo" className="text-right">Placa</Label>
                                <Input id="placa-veiculo" placeholder="ABC-1234" className="col-span-3" {...registerVeiculo("placa")} />
                            </div>
                            {errorsVeiculo.placa && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsVeiculo.placa.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="modelo-veiculo" className="text-right">Modelo</Label>
                                <Input id="modelo-veiculo" placeholder="Ex: Honda Civic" className="col-span-3" {...registerVeiculo("modelo")} />
                            </div>
                            {errorsVeiculo.modelo && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsVeiculo.modelo.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidade-veiculo" className="text-right">Unidade</Label>
                                <Input id="unidade-veiculo" placeholder="Ex: Apto 101" className="col-span-3" {...registerVeiculo("unidade")} />
                            </div>
                            {errorsVeiculo.unidade && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsVeiculo.unidade.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {veiculos.map(v => (
                    <TableRow key={v.id}>
                        <TableCell>{v.placa}</TableCell>
                        <TableCell>{v.modelo}</TableCell>
                        <TableCell>{v.unidade}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </TabsContent>

            {/* Tab de Fornecedores */}
            <TabsContent value="fornecedores">
            <div className="flex justify-end mb-4">
            <Dialog open={openFornecedor} onOpenChange={setOpenFornecedor}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2" />Adicionar Fornecedor</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Fornecedor</DialogTitle>
                        <DialogDescription>Insira os dados do novo fornecedor.</DialogDescription>
                    </DialogHeader>
                        <form onSubmit={handleSubmitFornecedor(onFornecedorSubmit)}>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-fornecedor" className="text-right">Nome</Label>
                                <Input id="nome-fornecedor" placeholder="Nome da empresa" className="col-span-3" {...registerFornecedor("nome")} />
                            </div>
                            {errorsFornecedor.nome && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFornecedor.nome.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="servico-fornecedor" className="text-right">Serviço</Label>
                                <Input id="servico-fornecedor" placeholder="Ex: Jardinagem" className="col-span-3" {...registerFornecedor("servico")} />
                            </div>
                            {errorsFornecedor.servico && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFornecedor.servico.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contato-fornecedor" className="text-right">Contato</Label>
                                <Input id="contato-fornecedor" placeholder="Email ou telefone" className="col-span-3" {...registerFornecedor("contato")} />
                            </div>
                            {errorsFornecedor.contato && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsFornecedor.contato.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {fornecedores.map(f => (
                        <TableRow key={f.id}>
                        <TableCell>{f.nome}</TableCell>
                        <TableCell>{f.servico}</TableCell>
                        <TableCell>{f.contato}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </TabsContent>

            {/* Tab de Pets */}
            <TabsContent value="pets">
            <div className="flex justify-end mb-4">
            <Dialog open={openPet} onOpenChange={setOpenPet}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2" />Adicionar Pet</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Pet</DialogTitle>
                        <DialogDescription>Insira os dados do pet.</DialogDescription>
                    </DialogHeader>
                        <form onSubmit={handleSubmitPet(onPetSubmit)}>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-pet" className="text-right">Nome</Label>
                                <Input id="nome-pet" placeholder="Nome do animal" className="col-span-3" {...registerPet("nome")} />
                            </div>
                            {errorsPet.nome && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsPet.nome.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="raca-pet" className="text-right">Raça</Label>
                                <Input id="raca-pet" placeholder="Ex: Labrador" className="col-span-3" {...registerPet("raca")} />
                            </div>
                            {errorsPet.raca && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsPet.raca.message}</p>}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="porte-pet" className="text-right">Porte</Label>
                                    <Select onValueChange={(value) => registerPet("porte").onChange({ target: { value } })}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pequeno">Pequeno</SelectItem>
                                        <SelectItem value="medio">Médio</SelectItem>
                                        <SelectItem value="grande">Grande</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {errorsPet.porte && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsPet.porte.message}</p>}
                                <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidade-pet" className="text-right">Unidade</Label>
                                <Input id="unidade-pet" placeholder="Ex: Apto 101" className="col-span-3" {...registerPet("unidade")} />
                            </div>
                            {errorsPet.unidade && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsPet.unidade.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Porte</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                    {pets.map(p => (
                    <TableRow key={p.id}>
                        <TableCell>{p.nome}</TableCell>
                        <TableCell>{p.raca}</TableCell>
                        <TableCell>{p.porte}</TableCell>
                        <TableCell>{p.unidade}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </TabsContent>

        {/* Tab de Blocos e Unidades */}
        <TabsContent value="blocos">
            <div className="flex justify-end mb-4">
            <Dialog open={openBloco} onOpenChange={setOpenBloco}>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2" />Adicionar Bloco</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Bloco</DialogTitle>
                        <DialogDescription>Insira os dados do novo bloco.</DialogDescription>
                    </DialogHeader>
                        <form onSubmit={handleSubmitBloco(onBlocoSubmit)}>
                            <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-bloco" className="text-right">Nome</Label>
                                <Input id="nome-bloco" placeholder="Ex: Bloco A" className="col-span-3" {...registerBloco("nome")} />
                            </div>
                            {errorsBloco.nome && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsBloco.nome.message}</p>}
                                <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidades-bloco" className="text-right">Nº de Unidades</Label>
                                <Input id="unidades-bloco" type="number" placeholder="Ex: 40" className="col-span-3" {...registerBloco("unidades")} />
                            </div>
                            {errorsBloco.unidades && <p className="col-start-2 col-span-3 text-xs text-destructive">{errorsBloco.unidades.message}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            </div>
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome do Bloco</TableHead>
                    <TableHead>Nº de Unidades</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                    {blocos.map(b => (
                    <TableRow key={b.id}>
                        <TableCell>{b.nome}</TableCell>
                        <TableCell>{b.unidades}</TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </TabsContent>

        </Tabs>
    </AppLayout>
  );
}

    